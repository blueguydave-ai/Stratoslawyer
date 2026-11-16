// Public browser credentials only. Never place a Supabase secret/service-role key here.
// The canonical production domain uses the production database. Every preview/local
// deployment uses the isolated Preview database so tests cannot touch customer records.
const isProductionHost = window.location.hostname === "stratoslawyer.vercel.app";

window.STRATOS_SUPABASE_URL = isProductionHost
  ? "https://jrwbthzdoibmrmqoqklg.supabase.co"
  : "https://dyjudgbbrusrmsoiwqto.supabase.co";

window.STRATOS_SUPABASE_PUBLISHABLE_KEY = isProductionHost
  ? "sb_publishable_flbGYkCA3hUKxFXIJYV1Mw_vroE6hcp"
  : "sb_publishable_pONSgZghmjjQqHj3Eij9Nw_Ay3JW9SA";
