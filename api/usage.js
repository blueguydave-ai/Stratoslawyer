const SUPABASE_URL = process.env.SUPABASE_URL || "https://jrwbthzdoibmrmqoqklg.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_flbGYkCA3hUKxFXIJYV1Mw_vroE6hcp";

function send(res,status,payload) {
  return res.status(status).json(payload);
}

export default async function handler(req,res) {
  if (req.method !== "GET") {
    res.setHeader("Allow","GET");
    return send(res,405,{error:"Method not allowed."});
  }

  const authorization = req.headers.authorization || req.headers.Authorization || "";
  const match = typeof authorization === "string" && authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match || match[1].length > 8192) {
    return send(res,401,{error:"Please sign in to view your daily allowance."});
  }

  let user;
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`,{
      headers:{"apikey":SUPABASE_KEY,"Authorization":"Bearer " + match[1]},
      signal:AbortSignal.timeout(10000)
    });
    if (!response.ok) return send(res,401,{error:"Your session has expired. Please sign in again."});
    user = await response.json();
    if (!user?.id) return send(res,401,{error:"Your session could not be verified."});
  } catch(error) {
    return send(res,503,{error:"Your daily allowance is temporarily unavailable."});
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_daily_analysis_usage`,{
      method:"POST",
      headers:{
        "apikey":SUPABASE_KEY,
        "Authorization":"Bearer " + match[1],
        "Content-Type":"application/json"
      },
      body:JSON.stringify({p_user_id:user.id}),
      signal:AbortSignal.timeout(10000)
    });
    const payload = await response.json().catch(()=>null);
    if (!response.ok) return send(res,503,{error:"Your daily allowance is not ready yet. Please try again shortly."});
    const usage = Array.isArray(payload) ? payload[0] : payload;
    if (!usage) return send(res,503,{error:"Your daily allowance is not ready yet. Please try again shortly."});
    return send(res,200,{
      used:Number(usage.analyses_used)||0,
      remaining:Number(usage.analyses_remaining)||0,
      limit:Number(usage.daily_limit)||10,
      date:usage.usage_date
    });
  } catch(error) {
    return send(res,503,{error:"Your daily allowance is temporarily unavailable."});
  }
}
