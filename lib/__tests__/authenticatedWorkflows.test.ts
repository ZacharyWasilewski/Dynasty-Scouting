import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: null as null | {id:string;email:string}, query:vi.fn(), verify:vi.fn(), session:vi.fn(), remove:vi.fn(), deleteSession:vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser:async()=>state.user, verifyUserCredentials:state.verify, createSession:state.session, isAdminUser:()=>false, SESSION_COOKIE:"dd_session", deleteUserAccount:state.remove, deleteSession:state.deleteSession }));
vi.mock("@/lib/db",()=>({query:state.query}));
vi.mock("@/lib/rateLimit",()=>({checkRateLimit:()=>({allowed:true})}));
vi.mock("next/headers",()=>({cookies:()=>({get:()=>({value:"test-session"})})}));
const watch=await import("@/app/api/watchlist/route");
const board=await import("@/app/api/board/[year]/route");
const drafts=await import("@/app/api/mock-drafts/[id]/route");
const notifications=await import("@/app/api/notifications/preferences/route");
const login=await import("@/app/api/auth/login/route");
const logout=await import("@/app/api/auth/logout/route");
const deletion=await import("@/app/api/account/delete/route");
const req=(body:unknown={},method="POST")=>new Request("https://example.com/api/test",{method,body:JSON.stringify(body),headers:{"Content-Type":"application/json"}});
beforeEach(()=>{vi.clearAllMocks();state.user={id:"account-a",email:"test@example.com"};state.query.mockResolvedValue([]);state.verify.mockResolvedValue(state.user);state.session.mockResolvedValue({token:"test-token",expiresAt:new Date(Date.now()+3600000)});});
describe("account route verification (isolated auth/database fixtures)",()=>{
  it("rejects anonymous writes without touching saved data",async()=>{
    state.user=null;
    for(const result of [await watch.POST(req({prospectId:"p",saved:true})),await board.PUT(req({prospectIds:["p"]},"PUT"),{params:{year:"2027"}}),await notifications.POST(req({enabled:true})),await deletion.POST(req({password:"test-password"}))]) expect(result.status).toBe(401);
    expect(state.query).not.toHaveBeenCalled();expect(state.remove).not.toHaveBeenCalled();
  });
  it("saves a watchlist item idempotently under the authenticated account",async()=>{
    const response=await watch.POST(req({prospectId:"player-a",saved:true}));expect(await response.json()).toEqual({prospectId:"player-a",saved:true});
    expect(state.query).toHaveBeenCalledWith(expect.stringContaining("ON CONFLICT"),["account-a","player-a"]);
  });
  it("reads only the current user's watchlist",async()=>{
    state.query.mockResolvedValue([{prospect_id:"player-a"}]); expect(await (await watch.GET()).json()).toEqual({ids:["player-a"]});
    expect(state.query).toHaveBeenCalledWith(expect.stringContaining("WHERE user_id = $1"),["account-a"]);
  });
  it("saves and reloads the board ordering without substituting another account",async()=>{
    expect((await board.PUT(req({prospectIds:["b","a"]},"PUT"),{params:{year:"2027"}})).status).toBe(200);
    expect(state.query).toHaveBeenCalledWith(expect.any(String),["account-a","2027",'["b","a"]']);
    state.query.mockResolvedValue([{prospect_ids:["b","a"]}]); expect(await (await board.GET(new Request("https://example.com"),{params:{year:"2027"}})).json()).toEqual({prospectIds:["b","a"]});
  });
  it("rejects malformed board data without writing it",async()=>{expect((await board.PUT(req({prospectIds:[42]},"PUT"),{params:{year:"2027"}})).status).toBe(400);expect(state.query).not.toHaveBeenCalled();});
  it("does not return another account's saved draft",async()=>{
    const r=await drafts.GET(new Request("https://example.com"),{params:{id:"other-draft"}});expect(r.status).toBe(404);
    expect(state.query).toHaveBeenCalledWith(expect.stringContaining("id = $1 AND user_id = $2"),["other-draft","account-a"]);
  });
  it("scopes saved-draft removal to its owner",async()=>{await drafts.DELETE(new Request("https://example.com"),{params:{id:"draft-a"}});expect(state.query).toHaveBeenCalledWith(expect.stringContaining("id = $1 AND user_id = $2"),["draft-a","account-a"]);});
  it("notification preferences default off and save against the signed-in user",async()=>{
    expect(await (await notifications.GET(new Request("https://example.com"))).json()).toEqual({enabled:false});
    expect(await (await notifications.POST(req({enabled:true}))).json()).toEqual({ok:true,enabled:true});expect(state.query).toHaveBeenLastCalledWith(expect.any(String),["account-a",true]);
  });
  it("successful login sets an HTTP-only session and does not expose its token in JSON",async()=>{
    const r=await login.POST(req({email:"test@example.com",password:"test-password"}));expect(r.status).toBe(200);expect(r.headers.get("set-cookie")).toContain("HttpOnly");expect(r.headers.get("set-cookie")).toContain("SameSite=lax");expect(await r.json()).toEqual({user:{...state.user,isAdmin:false}});
  });
  it("invalid credentials do not create a session",async()=>{state.verify.mockResolvedValue(null);expect((await login.POST(req({email:"test@example.com",password:"incorrect"}))).status).toBe(401);expect(state.session).not.toHaveBeenCalled();});
  it("logout expires the cookie and deletes the current session",async()=>{const r=await logout.POST(req());expect(r.headers.get("set-cookie")).toContain("01 Jan 1970");expect(state.deleteSession).toHaveBeenCalledWith("test-session");});
  it("account deletion refuses an incorrect password",async()=>{state.verify.mockResolvedValue(null);expect((await deletion.POST(req({password:"incorrect"}))).status).toBe(401);expect(state.remove).not.toHaveBeenCalled();});
  it("verified deletion removes the current account and clears its session cookie",async()=>{const r=await deletion.POST(req({password:"test-password"}));expect(r.status).toBe(200);expect(state.remove).toHaveBeenCalledWith("account-a");expect(r.headers.get("set-cookie")).toContain("01 Jan 1970");});
});
