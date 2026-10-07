"use strict";
const LS_SUP="elt_supabase";
function saveSupabaseCredsObj(o){localStorage.setItem(LS_SUP,JSON.stringify(o));}
function loadSupabaseCredsObj(){try{return JSON.parse(localStorage.getItem(LS_SUP))||{};}catch(e){return {};}}
function updateSupabaseUI(){const s=loadSupabaseCredsObj(); if(s.url) $("supabaseUrl").value=s.url; if(s.key) $("supabaseKey").value=s.key; const st=$("supabaseStatus"); if(s.url && s.key){ st.textContent = "Connected (saved)"; } else if(s.url || s.key){ st.textContent = "Incomplete Supabase setup"; } else { st.textContent = "Not connected"; }}

async function checkSupabaseSyncStatus(){
  const sup=getSupabaseClient();
  if(!sup){
    updateSupabaseUI();
    toast('Supabase URL and anon key are required before checking sync');
    return {connected:false, tables:{customers:false,bills:false}, message:'Missing Supabase credentials'};
  }
  try{
    const [customersResult, billsResult] = await Promise.all([
      sup.from('customers').select('id', { count: 'exact', head: true }),
      sup.from('bills').select('id', { count: 'exact', head: true })
    ]);

    const status = {
      connected: true,
      tables: {
        customers: !customersResult.error,
        bills: !billsResult.error
      },
      customersCount: customersResult.count || 0,
      billsCount: billsResult.count || 0,
      message: ''
    };

    if(customersResult.error || billsResult.error){
      status.connected = false;
      status.message = (customersResult.error ? customersResult.error.message : '') || (billsResult.error ? billsResult.error.message : '');
      console.error('Supabase table check failed:', customersResult.error || billsResult.error);
      toast('Supabase DB check failed: '+status.message);
    } else {
      status.message = `DB ok: ${status.customersCount} customers, ${status.billsCount} bills`;
      toast(status.message);
    }

    return status;
  }catch(err){
    console.error('Supabase sync check error:', err);
    toast('Supabase DB check error: '+(err.message||err));
    return {connected:false, tables:{customers:false,bills:false}, message:(err.message||err)};
  }
}

function getSupabaseClient(){
  const s = loadSupabaseCredsObj();
  const urlField = $("supabaseUrl");
  const keyField = $("supabaseKey");
  const url = urlField ? urlField.value.trim() : s.url;
  const key = keyField ? keyField.value.trim() : s.key;
  if(url && key && (url !== s.url || key !== s.key)){
    saveSupabaseCredsObj({url,key});
    updateSupabaseUI();
    s.url = url; s.key = key;
  }
  if(!s.url||!s.key) return null;
  if(!window._supabaseClient || window._supabaseClient._supabaseUrl!==s.url || window._supabaseClient._supabaseKey!==s.key){
    if(!window.createSupabaseClient){toast('Supabase client loader not available'); return null;}
    window._supabaseClient = window.createSupabaseClient(s.url,s.key);
    window._supabaseClient._supabaseUrl=s.url;
    window._supabaseClient._supabaseKey=s.key;
  }
  return window._supabaseClient;
}

async function uploadBackupToSupabase(){
  const sup=getSupabaseClient(); if(!sup){toast('Save Supabase URL & key first');return;}
  const payload={settings,customers,bills,_v:1};
  try{
    const name='billing-backup-'+todayISO();
    const res=await sup.from('backups').insert([{name,data:payload}]);
    if(res.error){toast('Upload failed: '+(res.error.message||res.error)); console.error(res.error);
      console.log('If table "backups" does not exist, run this SQL in Supabase SQL editor:\nCREATE TABLE public.backups (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, created_at timestamptz DEFAULT now(), name text, data jsonb);');
    }else{toast('Backup uploaded to Supabase');}
  }catch(err){toast('Upload error');console.error(err);}
}

async function listBackupsFromSupabase(){
  const sup=getSupabaseClient(); if(!sup){toast('Save Supabase URL & key first');return;}
  try{
    const res=await sup.from('backups').select('id,name,created_at').order('created_at',{ascending:false}).limit(200);
    if(res.error){toast('List failed: '+res.error.message);console.error(res.error);return;}
    const rows=res.data||[];
    if(!rows.length){toast('No backups found');return;}
    // render modal with list
    const modal=$("backupListModal"); const list=$("backupListBody"); list.innerHTML="";
    rows.forEach(r=>{
      const tr=document.createElement('div'); tr.className='backup-row';
      tr.innerHTML=`<div style="flex:1"><b>${esc(r.name)||'untitled'}</b><div style="color:var(--muted);font-size:12px">${new Date(r.created_at).toLocaleString()}</div></div>
        <div style="display:flex;gap:8px">
          <button class="btn sm" data-id="${r.id}" data-action="load">Load</button>
          <button class="btn ghost sm" data-id="${r.id}" data-action="del">Delete</button>
        </div>`;
      list.appendChild(tr);
    });
    modal.style.display='block';
    // wire buttons
    list.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click',async e=>{
        const id=btn.dataset.id, act=btn.dataset.action;
        if(act==='load'){
          if(!confirm('Loading will REPLACE local data. Continue?'))return;
          const rec=await sup.from('backups').select('data').eq('id',id).single();
          if(rec.error){toast('Load failed');console.error(rec.error);return;}
          const d=rec.data.data;
          settings=Object.assign({},DEFAULT_SETTINGS,d.settings||{});
          customers=d.customers||[]; bills=d.bills||[];
          save(LS.settings,settings);save(LS.customers,customers);save(LS.bills,bills);
          fillSettings();refreshCustPicker();newBill();toast('Backup loaded'); modal.style.display='none';
        }else if(act==='del'){
          if(!confirm('Delete this backup?'))return;
          const dres=await sup.from('backups').delete().eq('id',id);
          if(dres.error){toast('Delete failed');console.error(dres.error);return;} 
          toast('Backup deleted');
          // refresh list
          listBackupsFromSupabase();
        }
      });
    });
  }catch(err){toast('List error');console.error(err);}  
}

async function loadLatestBackupFromSupabase(){
  const sup=getSupabaseClient(); if(!sup){toast('Save Supabase URL & key first');return;}
  try{
    const list=await sup.from('backups').select('id,created_at').order('created_at',{ascending:false}).limit(1);
    if(list.error||!list.data||!list.data.length){toast('No backups found');return;}
    const id=list.data[0].id;
    const rec=await sup.from('backups').select('data').eq('id',id).single();
    if(rec.error){toast('Load failed: '+rec.error.message);console.error(rec.error);return;}
    const d=rec.data.data;
    if(!confirm('Loading will REPLACE local data. Continue?')) return;
    settings=Object.assign({},DEFAULT_SETTINGS,d.settings||{});
    customers=d.customers||[]; bills=d.bills||[];
    save(LS.settings,settings);save(LS.customers,customers);save(LS.bills,bills);
    fillSettings();refreshCustPicker();newBill();toast('Backup loaded from Supabase');
  }catch(err){toast('Load error');console.error(err);}  
}

async function loadBillsFromSupabase(reset=false){
  const sup=getSupabaseClient(); if(!sup){toast('Save Supabase URL & key first');return;}
  try{
    if(reset){
      supabaseBillsPage = 0;
      supabaseBillsHasMore = false;
    }
    const start = supabaseBillsPage * SUPABASE_PAGE_SIZE;
    const end = start + SUPABASE_PAGE_SIZE - 1;
    const res = await sup.from('bills').select('id,data').order('created_at',{ascending:false}).range(start,end);
    if(res.error){toast('Load bills failed: '+res.error.message);console.error(res.error);return;}
    const rows = res.data||[];
    const existing = new Map(bills.map(b=>[b.id,b]));
    rows.forEach(r=>{
      const item = r.data;
      existing.set(item.id, item);
    });
    bills = Array.from(existing.values());
    save(LS.bills,bills);
    supabaseBillsHasMore = rows.length === SUPABASE_PAGE_SIZE;
    supabaseBillsPage += 1;
    updateLoadMoreButtons();
    toast('Loaded '+rows.length+' bills from Supabase');
    renderBills();
  }catch(err){toast('Load bills error');console.error(err);}  
}

async function loadCustomersFromSupabase(reset=false){
  const sup=getSupabaseClient(); if(!sup){toast('Save Supabase URL & key first');return;}
  try{
    if(reset){
      supabaseCustomersPage = 0;
      supabaseCustomersHasMore = false;
    }
    const start = supabaseCustomersPage * SUPABASE_PAGE_SIZE;
    const end = start + SUPABASE_PAGE_SIZE - 1;
    const res = await sup.from('customers').select('*').order('created_at',{ascending:false}).range(start,end);
    if(res.error){toast('Load customers failed: '+res.error.message);console.error(res.error);return;}
    const rows = res.data||[];
    const existing = new Map(customers.map(c=>[(c._id||c.id),c]));
    rows.forEach(r=>{
      const item = {name:r.name,addr:r.addr,gst:r.gst,phone:r.phone||"",_id:r.id};
      existing.set(r.id, item);
    });
    customers = Array.from(existing.values());
    save(LS.customers,customers);
    supabaseCustomersHasMore = rows.length === SUPABASE_PAGE_SIZE;
    supabaseCustomersPage += 1;
    updateLoadMoreButtons();
    toast('Loaded '+rows.length+' customers from Supabase');
    renderCustomers();
  }catch(err){toast('Load customers error');console.error(err);}  
}

function updateLoadMoreButtons(){
  const billsBtn = $("loadMoreBillsBtn");
  const custBtn = $("loadMoreCustomersBtn");
  if(billsBtn) billsBtn.style.display = supabaseBillsHasMore ? 'inline-flex' : 'none';
  if(custBtn) custBtn.style.display = supabaseCustomersHasMore ? 'inline-flex' : 'none';
}

// Wire UI buttons
$("saveSupabaseBtn").addEventListener('click',async()=>{
  const url=$("supabaseUrl").value.trim(), key=$("supabaseKey").value.trim();
  if(!url||!key){toast('Enter URL and anon key');return;} saveSupabaseCredsObj({url,key}); updateSupabaseUI(); toast('Supabase credentials saved');
  await checkSupabaseSyncStatus();
});
$("checkDbSyncBtn").addEventListener('click',checkSupabaseSyncStatus);
$("uploadSupabaseBtn").addEventListener('click',uploadBackupToSupabase);
$("loadMoreBillsBtn").addEventListener('click',()=>loadBillsFromSupabase(false));
$("loadMoreCustomersBtn").addEventListener('click',()=>loadCustomersFromSupabase(false));
// helper: simple uuid v4
function uuidv4(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;const v=c==='x'?r:(r&0x3|0x8);return v.toString(16);});}

function ensureCustomerIds(){
  let changed=false;
  customers=customers.map(c=>{ if(!c._id){ c._id=uuidv4(); changed=true;} return c; });
  if(changed) save(LS.customers,customers);
}

async function syncCustomersAndBillsToSupabase(options={}){
  const quietSuccess = !!options.quietSuccess;
  const sup=getSupabaseClient(); if(!sup){if(!quietSuccess) toast('Save Supabase URL & key first');return false;}
  try{
    ensureCustomerIds();
    const custRows = customers.map(c=>({id:c._id,name:c.name,addr:c.addr,gst:c.gst,phone:c.phone||null}));
    const billRows = bills.map(b=>({id:b.id,data:b}));
    const errors = [];
    if(custRows.length){
      let r1 = await sup.from('customers').upsert(custRows,{onConflict:'id'});
      // Older databases have no "phone" column yet — sync the rest and explain how to add it
      if(r1.error && /phone/i.test(r1.error.message)){
        console.warn('customers.phone column missing. Run in Supabase SQL editor: ALTER TABLE public.customers ADD COLUMN phone text;');
        if(!quietSuccess) toast('Phone numbers not synced: run "ALTER TABLE public.customers ADD COLUMN phone text;" in Supabase SQL editor');
        r1 = await sup.from('customers').upsert(custRows.map(({phone,...rest})=>rest),{onConflict:'id'});
      }
      if(r1.error){errors.push('Customers: '+r1.error.message);console.error(r1.error);}
    }
    if(billRows.length){
      const r2 = await sup.from('bills').upsert(billRows,{onConflict:'id'});
      if(r2.error){errors.push('Bills: '+r2.error.message);console.error(r2.error);}
    }
    if(errors.length){
      const msg = errors.join(' | ');
      if(!quietSuccess){
        const detail = /permission denied|row level security|RLS|policy/i.test(msg) ? ' Permission denied by Supabase RLS. Run the SQL below in Supabase SQL editor, then retry: ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY; ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY; CREATE POLICY "Allow anon full access to customers" ON public.customers FOR ALL USING (true) WITH CHECK (true); CREATE POLICY "Allow anon full access to bills" ON public.bills FOR ALL USING (true) WITH CHECK (true);' : ' Check that the tables exist and the anon key has write access.';
        toast('Supabase sync failed: '+msg + detail);
      }
      console.error('Supabase sync failed:', errors);
      return false;
    }
    if(!quietSuccess) toast('Customers and bills synced to Supabase');
    return true;
  }catch(err){
    const msg = err.message || err;
    if(!quietSuccess) toast('Supabase sync error: '+msg + ' Check tables and RLS policy.');
    console.error(err);
    return false;
  }  
}

$("syncDataBtn").addEventListener('click',syncCustomersAndBillsToSupabase);
$("listSupabaseBtn").addEventListener('click',listBackupsFromSupabase);
$("loadSupabaseLatestBtn").addEventListener('click',loadLatestBackupFromSupabase);

function initAccordion(container){
  const items = container.querySelectorAll('.accordion-item');
  items.forEach((item, idx)=>{
    const btn = item.querySelector('.accordion-toggle');
    const panel = item.querySelector('.accordion-panel');
    // first item open by default
    if(idx===0){
      btn.classList.add('active');
      panel.classList.add('active');
    }
    btn.addEventListener('click',()=>{
      // close all others
      items.forEach(otherItem=>{
        const otherBtn = otherItem.querySelector('.accordion-toggle');
        const otherPanel = otherItem.querySelector('.accordion-panel');
        otherBtn.classList.remove('active');
        otherPanel.classList.remove('active');
      });
      // open this one
      btn.classList.add('active');
      panel.classList.add('active');
    });
  });
}

updateSupabaseUI();
initAccordion($("view-settings"));
// modal close
try{ $("closeBackupList").addEventListener('click',()=>$("backupListModal").style.display='none'); }catch(e){}

/* SQL to create minimal tables and allow writes for anon key (run in Supabase SQL editor):

CREATE TABLE public.customers (
  id text PRIMARY KEY,
  name text,
  addr text,
  gst text,
  phone text,
  created_at timestamptz DEFAULT now()
);
-- existing databases: ALTER TABLE public.customers ADD COLUMN phone text;

CREATE TABLE public.bills (
  id text PRIMARY KEY,
  data jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access to customers"
  ON public.customers
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon full access to bills"
  ON public.bills
  FOR ALL
  USING (true)
  WITH CHECK (true);

*/
