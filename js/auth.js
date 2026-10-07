"use strict";
/* ============================================================
   LOGIN (Supabase Auth, email + password)
   Users are created in the Supabase dashboard — there is no public sign-up.
   ============================================================ */

function showLogin(msg){
  $("loginScreen").hidden = false;
  $("loginError").textContent = msg || "";
  $("loginBtn").disabled = false;
  $("loginBtn").textContent = "Log in";
}

async function onSignedIn(user){
  currentUser = user;
  $("loginScreen").hidden = true;
  $("loginPassword").value = "";
  $("authEmail").textContent = user.email;
  updateSupabaseUI();
  // push anything saved on this device while offline / before login, then pull the shared data
  await syncCustomersAndBillsToSupabase({quietSuccess:true});
  await loadCustomersFromSupabase(true);
  await loadBillsFromSupabase(true);
  refreshCustPicker();
}

$("loginForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const sb = supabaseClient();
  if(!sb){ showLogin("App is not configured — Supabase key missing in js/config.js"); return; }
  const email = $("loginEmail").value.trim(), password = $("loginPassword").value;
  $("loginBtn").disabled = true; $("loginBtn").textContent = "Logging in…"; $("loginError").textContent = "";
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if(error){ showLogin(error.message === "Invalid login credentials" ? "Wrong email or password" : error.message); return; }
  await onSignedIn(data.user);
});

$("logoutBtn").addEventListener("click", async ()=>{
  const ok = await syncCustomersAndBillsToSupabase({quietSuccess:true});
  if(!ok && !confirm("Some bills/customers could not be uploaded to the cloud and will be lost from this device. Log out anyway?")) return;
  await supabaseClient().auth.signOut();
  // don't leave billing data on a device that has logged out
  bills = []; customers = [];
  save(LS.bills, bills); save(LS.customers, customers);
  location.reload();
});

async function initAuth(){
  localStorage.removeItem("elt_supabase"); // old per-device URL/key, no longer used
  const sb = supabaseClient();
  if(!sb){ showLogin("App is not configured — Supabase key missing in js/config.js"); return; }
  const { data } = await sb.auth.getSession();
  if(data.session) await onSignedIn(data.session.user);
  else showLogin();
  sb.auth.onAuthStateChange((event, session)=>{
    if(event === "SIGNED_OUT"){ currentUser = null; showLogin("You have been logged out"); }
  });
}
