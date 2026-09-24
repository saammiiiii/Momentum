// Fake transport only for browser tests. Never imported by production code.
export function fakeSupabase() {
  const users = new Map(), tokens = new Map(), snapshots = new Map(), profiles = new Map();
  const calls = { recover: 0, resend: 0 };
  function tokenFor(user) {
    const token = Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url") + "." + Buffer.from(JSON.stringify({ sub:user.id, role:"authenticated", exp:Math.floor(Date.now()/1000)+3600 })).toString("base64url") + ".dGVzdA";
    tokens.set(token,user);
    return { access_token:token,refresh_token:"fake-refresh-"+user.id,expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:"bearer",user:publicUser(user) };
  }
  const publicUser=(user)=>({id:user.id,email:user.email,email_confirmed_at:user.confirmed?"2026-09-24T10:00:00Z":null,confirmed_at:user.confirmed?"2026-09-24T10:00:00Z":null,created_at:"2026-09-24T10:00:00Z",aud:"authenticated",role:"authenticated",user_metadata:{username:user.username},app_metadata:{provider:"email",providers:["email"]}});
  async function route(context) {
    await context.route("https://momentum-test.invalid/**",async(route)=>{
      const request=route.request(), url=new URL(request.url());
      const body=request.postDataJSON() || {};
      const user=tokens.get(request.headers().authorization?.replace("Bearer ",""));
      const send=(data,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(data),headers:{"access-control-allow-origin":"*"}});
      if(request.method()==="OPTIONS")return route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"GET,POST,PATCH,DELETE,OPTIONS"}});
      if(url.pathname==="/auth/v1/signup"){
        if(!users.has(body.email)){
          const created={id:crypto.randomUUID(),email:body.email,password:body.password,username:body.data.username,confirmed:false};
          users.set(body.email,created);profiles.set(created.id,{username:created.username,avatar:""});
        }
        return send(publicUser(users.get(body.email)));
      }
      if(url.pathname==="/auth/v1/token"){
        const found=url.searchParams.get("grant_type")==="refresh_token"?[...users.values()].find(u=>"fake-refresh-"+u.id===body.refresh_token):users.get(body.email);
        if(!found || (body.password && found.password!==body.password))return send({code:"invalid_credentials",msg:"Invalid login credentials"},400);
        if(!found.confirmed)return send({code:"email_not_confirmed",msg:"Email not confirmed"},400);
        return send(tokenFor(found));
      }
      if(url.pathname==="/auth/v1/recover"){calls.recover++;return send({});}
      if(url.pathname==="/auth/v1/resend"){calls.resend++;return send({});}
      if(url.pathname==="/auth/v1/logout")return send({});
      if(!user)return send({message:"Unauthorized"},401);
      if(url.pathname==="/auth/v1/user"){
        if(body.password)user.password=body.password;
        return send(publicUser(user));
      }
      if(url.pathname==="/rest/v1/profiles"){
        if(request.method()==="PATCH") {profiles.set(user.id,{...profiles.get(user.id),...body});return send(null);}
        return send(profiles.get(user.id));
      }
      if(url.pathname==="/rest/v1/rpc/momentum_read")return send(snapshots.get(user.id)||{state:null,revision:0});
      if(url.pathname==="/rest/v1/rpc/momentum_save"){
        const old=snapshots.get(user.id)||{revision:0};
        if(old.revision!==body.expected_revision)return send({code:"P0001",message:"MOMENTUM_CONFLICT"},400);
        const next={state:structuredClone(body.document),revision:old.revision+1};snapshots.set(user.id,next);return send({revision:next.revision});
      }
      return send({message:"Unexpected fake endpoint"},404);
    });
  }
  return { route,calls,users,snapshots,
    callback(email,type="signup") {const user=users.get(email);user.confirmed=true;const session=tokenFor(user);return "?auth="+(type==="recovery"?"recovery":"confirm")+"#"+new URLSearchParams({access_token:session.access_token,refresh_token:session.refresh_token,expires_in:"3600",token_type:"bearer",type});},
  };
}
