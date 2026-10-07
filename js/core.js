"use strict";
/* ============================================================
   Simple billing app — shared helpers & state (loaded first).
   Data persisted in localStorage. Print via window.print().
   ============================================================ */
const LS = {
  settings:"elt_settings", customers:"elt_customers", bills:"elt_bills"
};
const $ = id => document.getElementById(id);
const money = n => (Number(n)||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const todayISO = () => new Date().toISOString().slice(0,10);
const load = (k,def) => { try{return JSON.parse(localStorage.getItem(k)) ?? def;}catch(e){return def;} };
const save = (k,v) => localStorage.setItem(k,JSON.stringify(v));
const normalizeArray = value => Array.isArray(value) ? value.filter(Boolean) : [];
const SUPABASE_PAGE_SIZE = 10;
let supabaseBillsPage = 0;
let supabaseCustomersPage = 0;
let supabaseBillsHasMore = false;
let supabaseCustomersHasMore = false;

function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("show"),2200);}

function bindSearchShell(inputId, renderFn){
  const input = $(inputId);
  const shell = input.closest(".search-shell");
  const clearBtn = shell.querySelector(".search-clear");
  const sync = () => shell.classList.toggle("has-value", input.value.trim().length > 0);
  input.addEventListener("input", ()=>{ sync(); renderFn(); });
  clearBtn.addEventListener("click", ()=>{ input.value=""; sync(); renderFn(); input.focus(); });
  sync();
}

/* ---------- Defaults seeded from the sample bill ---------- */
const DEFAULT_SETTINGS = {
  title:"TRANSPORT BILL",
  name:"EXPRESS LOGISTICS AND TRANSPORTS",
  addr:"NH-Bye Pass, Chalakudy-680307\nThrissur Dist Kerala  Ph 8848426692",
  gst:"32CEBPB8111C1ZG",
  bankName:"EXPRESS LOGISTICS & TRANSPORTS",
  bank:"CANARA BANK", branch:"IRINJALAKUDA",
  acc:"1200 2933 5780", ifsc:"CNRB0000807",
  fy:"2026-2027", lastInv:3, logo:"", seal:"", sign:""
};

let settings = Object.assign({}, DEFAULT_SETTINGS, load(LS.settings,{}));
let customers = normalizeArray(load(LS.customers,[]));
let bills = normalizeArray(load(LS.bills,[]));
let editingId = null; // id of bill being edited, else null
let currentUser = null; // Supabase user once logged in (see auth.js)

/* ---------- Number to words (Indian system) ---------- */
function numToWords(num){
  num = Math.round(Number(num)||0);
  if(num===0) return "Zero only";
  const a=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const b=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const two = n => n<20 ? a[n] : b[Math.floor(n/10)] + (n%10? " "+a[n%10]:"");
  const three = n => (n>=100? a[Math.floor(n/100)]+" Hundred"+(n%100?" ":""):"") + (n%100? two(n%100):"");
  let res="", crore=Math.floor(num/10000000); num%=10000000;
  let lakh=Math.floor(num/100000); num%=100000;
  let thou=Math.floor(num/1000); num%=1000;
  let hund=num;
  if(crore) res+=three(crore)+" Crore ";
  if(lakh) res+=two(lakh)+" Lakh ";
  if(thou) res+=two(thou)+" Thousand ";
  if(hund) res+=three(hund);
  return res.trim().replace(/\s+/g," ") + " only";
}
