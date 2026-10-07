"use strict";
/* ============================================================
   ITEMS TABLE
   ============================================================ */
function addRow(data={}){
  const tr=document.createElement("tr");
  tr.innerHTML=`
    <td class="rownum"></td>
    <td><input type="date" class="i-date" value="${data.date||todayISO()}"></td>
    <td><input class="i-hsn" value="9965" readonly></td>
    <td><input class="i-veh" value="${(data.veh||"").toUpperCase()}" placeholder="TS 09 UB 8049"></td>
    <td><textarea class="i-part" rows="1" placeholder="Transportation of goods…">${data.part||""}</textarea></td>
    <td class="num"><input type="number" step="0.01" class="i-amt num" style="text-align:right" value="${data.amt??""}" placeholder="0.00"></td>
    <td><button class="del-row" title="Remove">×</button></td>`;
  tr.querySelector(".del-row").addEventListener("click",()=>{tr.remove();renumber();recalc();});
  tr.querySelector(".i-amt").addEventListener("input",e=>{
    if(Number(e.target.value) < 0) e.target.value = '0';
    recalc();
  });
  const vehField = tr.querySelector(".i-veh");
  const upperVeh = e=>{e.target.value = e.target.value.toUpperCase();};
  vehField.addEventListener("focus",upperVeh);
  vehField.addEventListener("input",upperVeh);
  $("itemsBody").appendChild(tr);
  renumber();
}
function renumber(){[...$("itemsBody").children].forEach((tr,i)=>tr.querySelector(".rownum").textContent=i+1);}
function readItems(){
  return [...$("itemsBody").children].map(tr=>({
    date:tr.querySelector(".i-date").value,
    hsn:"9965",
    veh:tr.querySelector(".i-veh").value.trim().toUpperCase(),
    part:tr.querySelector(".i-part").value.trim(),
    amt:Math.max(0,Number(tr.querySelector(".i-amt").value)||0)
  }));
}

function validateBillItems(){
  const invalid = readItems().some(i=>i.amt < 0);
  if(invalid){ toast('Item amount cannot be negative'); return false; }
  return true;
}
