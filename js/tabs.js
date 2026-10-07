"use strict";
/* ============================================================
   TAB NAVIGATION
   ============================================================ */
document.querySelectorAll("nav.tabs button").forEach(btn=>{
  btn.addEventListener("click",async ()=>{
    const currentTab = document.querySelector("nav.tabs button.active")?.dataset.tab;
    if(currentTab === "create" && btn.dataset.tab !== "create"){
      clearBillForm({silent:true});
    }
    document.querySelectorAll("nav.tabs button").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    btn.classList.add("active");
    $("view-"+btn.dataset.tab).classList.add("active");
    if(btn.dataset.tab==="saved"){
      if(getSupabaseClient()){
        await loadBillsFromSupabase(true);
      } else {
        renderBills();
      }
    }
    if(btn.dataset.tab==="customers"){
      if(getSupabaseClient()){
        await loadCustomersFromSupabase(true);
      } else {
        renderCustomers();
      }
    }
  });
});
