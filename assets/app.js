const DBKEY="smartstore_pos_v2";
const demo=[{id:"p1",name:"Rice 5 KG",price:320,stock:20,low:5,cat:"Grocery"},{id:"p2",name:"Sugar 1 KG",price:48,stock:50,low:8,cat:"Grocery"},{id:"p3",name:"Milk 1 L",price:65,stock:25,low:5,cat:"Dairy"},{id:"p4",name:"Biscuits",price:30,stock:40,low:8,cat:"Snacks"},{id:"p5",name:"Cooking Oil 1 L",price:145,stock:18,low:5,cat:"Grocery"},{id:"p6",name:"Bath Soap",price:38,stock:35,low:5,cat:"Personal Care"}];
let db=JSON.parse(localStorage.getItem(DBKEY)||"null")||{products:demo,bills:[],customers:[],settings:{name:"My General Store",phone:"",upi:"",address:"",gstin:"",footer:"Thank you for shopping!"}};
let cart=[], editProductId=null;

const $=id=>document.getElementById(id);
const money=n=>"₹"+Number(n||0).toFixed(2);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function persist(){localStorage.setItem(DBKEY,JSON.stringify(db))}
function toast(msg){let t=$("toast");t.textContent=msg;t.style.display="block";clearTimeout(window.tt);window.tt=setTimeout(()=>t.style.display="none",2200)}
function toggleSidebar(){$("sidebar").classList.toggle("open")}
function showPage(page){
 document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));
 $(page).classList.remove("hidden");
 document.querySelectorAll("nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
 if(window.innerWidth<701)$("sidebar").classList.remove("open");
 if(page==="dashboard")renderDashboard();
 if(page==="products")renderProducts();
 if(page==="customers")renderCustomers();
 if(page==="sales")renderSales();
 if(page==="ledger")renderLedger();
 if(page==="reports")renderReports();
 if(page==="settings")loadSettings();
 if(page==="billing"){fillCats();renderBillProducts();renderCart()}
}
function toggleDark(){document.body.classList.toggle("dark");localStorage.setItem("smart_dark",document.body.classList.contains("dark"))}
if(localStorage.getItem("smart_dark")==="true")document.body.classList.add("dark");

function fillCats(){let cats=[...new Set(db.products.map(p=>p.cat).filter(Boolean))];$("billCat").innerHTML='<option value="">All categories</option>'+cats.map(c=>`<option>${esc(c)}</option>`).join("")}
function renderBillProducts(){
 let q=$("billSearch").value.toLowerCase(),cat=$("billCat").value;
 let ps=db.products.filter(p=>(p.name+" "+p.cat).toLowerCase().includes(q)&&(!cat||p.cat===cat));
 $("billProducts").innerHTML=ps.map(p=>`<button class="product-card" onclick="addToCart('${p.id}')" ${p.stock<=0?"disabled":""}><b>${esc(p.name)}</b><small>${money(p.price)} • Stock ${p.stock}</small></button>`).join("")||'<div class="empty">No matching products.</div>'
}
function addToCart(id){
 let p=db.products.find(x=>x.id===id);if(!p)return;
 let x=cart.find(i=>i.id===id);
 if(x){if(x.qty<p.stock)x.qty++;else return toast("Stock limit reached")}
 else cart.push({id:p.id,name:p.name,price:p.price,qty:1});
 renderCart()
}
function qty(id,d){
 let x=cart.find(i=>i.id===id),p=db.products.find(i=>i.id===id);if(!x)return;
 x.qty+=d;if(x.qty<=0)cart=cart.filter(i=>i.id!==id);
 if(x.qty>p.stock){x.qty=p.stock;toast("Stock limit reached")}
 renderCart()
}
function removeCart(id){cart=cart.filter(x=>x.id!==id);renderCart()}
function renderCart(){
 $("cart").innerHTML=cart.map(x=>`<tr><td>${esc(x.name)}</td><td>${money(x.price)}</td><td><div class="qty"><button onclick="qty('${x.id}',-1)">−</button><b>${x.qty}</b><button onclick="qty('${x.id}',1)">+</button></div></td><td>${money(x.price*x.qty)}</td><td><button class="red" onclick="removeCart('${x.id}')">×</button></td></tr>`).join("");
 $("cartEmpty").classList.toggle("hidden",cart.length>0);calc()
}
function calc(){
 let sub=cart.reduce((a,x)=>a+x.price*x.qty,0),d=Math.min(sub,Math.max(0,+$("billDiscount").value||0)),gstBase=sub-d,gst=gstBase*Math.max(0,+$("billGst").value||0)/100,total=gstBase+gst;
 $("sub").textContent=money(sub);$("disc").textContent="−"+money(d);$("tax").textContent=money(gst);$("total").textContent=money(total);return{sub,discount:d,gst,total}
}
function invoice(){return "INV-"+new Date().getFullYear()+"-"+String(Date.now()).slice(-7)}
function makeBill(){
 let c=calc();return{id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),no:invoice(),date:new Date().toISOString(),customer:$("custName").value.trim()||"Walk-in Customer",phone:$("custPhone").value.trim(),payment:$("payment").value,items:cart.map(x=>({...x})),...c,status:$("payment").value==="Credit / Udhaar"?"unpaid":"paid"}
}
function ensureCustomer(name,phone){
 if(!name||name==="Walk-in Customer")return;
 let c=db.customers.find(x=>x.phone&&x.phone===phone);
 if(!c){c={id:Date.now().toString(),name,phone,bills:0,spent:0};db.customers.push(c)}
 c.bills++;c.spent+=calc().total
}
function saveCurrent(mode="save"){
 if(!cart.length)return toast("Add at least one product");
 let b=makeBill();
 if(mode==="whatsapp"){shareWhatsApp(b);return}
 db.bills.unshift(b);b.items.forEach(x=>{let p=db.products.find(p=>p.id===x.id);if(p)p.stock=Math.max(0,p.stock-x.qty)});ensureCustomer(b.customer,b.phone);persist();
 toast("Saved "+b.no);renderProducts();newBill(false)
}
function newBill(confirmIt=true){
 if(confirmIt&&cart.length&&!confirm("Clear current bill?"))return;
 cart=[];["custName","custPhone"].forEach(id=>$(id).value="");$("billDiscount").value=0;$("billGst").value=0;$("payment").value="Cash";$("qrBox").classList.add("hidden");renderCart()
}
function shareWhatsApp(b){
 let text=`*${db.settings.name}*%0ABill: ${b.no}%0ACustomer: ${b.customer}%0A%0A`+b.items.map(x=>`${x.name} x ${x.qty} = ${money(x.price*x.qty)}`).join("%0A")+`%0A%0A*Total: ${money(b.total)}*`;
 if(b.phone){let phone=b.phone.replace(/\D/g,"");if(phone.length===10)phone="91"+phone;window.open("https://wa.me/"+phone+"?text="+text,"_blank")}else window.open("https://wa.me/?text="+text,"_blank")
}
function generateQR(){
 if(!cart.length)return toast("Add items first");
 if(!db.settings.upi){showPage("settings");toast("Enter your UPI ID first");return}
 let total=calc().total,ref="TXN"+Date.now(),payload=`upi://pay?pa=${encodeURIComponent(db.settings.upi)}&pn=${encodeURIComponent(db.settings.name)}&am=${total.toFixed(2)}&cu=INR&tr=${ref}&tn=${encodeURIComponent("Store Bill "+invoice())}`;
 $("qrcode").innerHTML="";new QRCode($("qrcode"),{text:payload,width:190,height:190});$("qrAmount").textContent=money(total);$("qrRef").textContent="Payment Ref: "+ref;$("qrBox").classList.remove("hidden")
}
function printCurrent(){if(!cart.length)return toast("Add items first");printBill(makeBill())}
function printBill(b){
 let s=db.settings;
 $("printArea").innerHTML=`<div class="print-receipt"><h2>${esc(s.name)}</h2><div class="center">${esc(s.address)}<br>${esc(s.phone)}</div><hr><div><b>Bill:</b> ${b.no}<br><b>Date:</b> ${new Date(b.date).toLocaleString("en-IN")}<br><b>Customer:</b> ${esc(b.customer)}${b.phone?"<br><b>Mobile:</b> "+esc(b.phone):""}</div><hr><div class="print-items">${b.items.map(x=>`<div><span>${esc(x.name)} × ${x.qty}</span><span>${money(x.price*x.qty)}</span></div>`).join("")}</div><hr><div class="print-row"><span>Subtotal</span><b>${money(b.sub)}</b></div><div class="print-row"><span>Discount</span><b>−${money(b.discount)}</b></div><div class="print-row"><span>GST</span><b>${money(b.gst)}</b></div><hr><div class="print-row print-total"><span>TOTAL</span><span>${money(b.total)}</span></div><p class="center">${esc(s.footer)}</p></div>`;
 window.print()
}
function renderDashboard(){
 let today=new Date().toDateString(),bs=db.bills.filter(b=>new Date(b.date).toDateString()===today),sales=bs.reduce((a,b)=>a+b.total,0),low=db.products.filter(p=>p.stock<=p.low);
 $("dSales").textContent=money(sales);$("dBills").textContent=bs.length;$("dProducts").textContent=db.products.length;$("dLow").textContent=low.length;
 $("dashBills").innerHTML=bs.slice(0,7).map(b=>`<div class="print-row"><span><b>${b.no}</b><br><small>${esc(b.customer)}</small></span><b>${money(b.total)}</b></div>`).join("")||'<div class="empty">No bills today.</div>';
 $("dashLow").innerHTML=low.map(p=>`<div class="print-row"><span>${esc(p.name)}</span><b>${p.stock} left</b></div>`).join("")||'<div class="empty">Stock looks good.</div>'
}
function openProduct(id=null){
 editProductId=id;let p=id&&db.products.find(x=>x.id===id);$("modalTitle").textContent=p?"Edit Product":"Add Product";
 $("pName").value=p?.name||"";$("pPrice").value=p?.price||"";$("pStock").value=p?.stock??"";$("pLow").value=p?.low??5;$("pCat").value=p?.cat||"";$("modal").classList.remove("hidden")
}
function closeModal(){$("modal").classList.add("hidden")}
function saveProduct(){
 let name=$("pName").value.trim(),price=+$("pPrice").value,stock=+$("pStock").value||0,low=+$("pLow").value||0,cat=$("pCat").value.trim()||"General";
 if(!name||price<=0)return toast("Enter valid name and price");
 if(editProductId){let p=db.products.find(x=>x.id===editProductId);Object.assign(p,{name,price,stock,low,cat})}
 else db.products.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name,price,stock,low,cat});
 persist();closeModal();renderProducts();fillCats();renderBillProducts();toast("Product saved")
}
function renderProducts(){
 let q=($("productSearch")?.value||"").toLowerCase();let ps=db.products.filter(p=>(p.name+" "+p.cat).toLowerCase().includes(q));
 $("productTable").innerHTML=ps.map(p=>`<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.cat)}</td><td>${money(p.price)}</td><td><b class="${p.stock<=p.low?"red":""}">${p.stock}</b></td><td>${p.low}</td><td><button onclick="openProduct('${p.id}')">Edit</button> <button class="red" onclick="deleteProduct('${p.id}')">Delete</button></td></tr>`).join("")
}
function deleteProduct(id){if(!confirm("Delete this product?"))return;db.products=db.products.filter(p=>p.id!==id);persist();renderProducts();renderBillProducts();toast("Product deleted")}
function seedProducts(){let existing=new Set(db.products.map(p=>p.name.toLowerCase()));demo.forEach(p=>{if(!existing.has(p.name.toLowerCase()))db.products.push({...p,id:Date.now()+Math.random()})});persist();renderProducts();fillCats();renderBillProducts();toast("Demo products added")}
function openCustomer(){$("customerModal").classList.remove("hidden")}
function closeCustomer(){$("customerModal").classList.add("hidden")}
function saveCustomer(){let name=$("cName").value.trim(),phone=$("cPhone").value.trim();if(!name)return toast("Enter customer name");db.customers.push({id:Date.now().toString(),name,phone,bills:0,spent:0});persist();closeCustomer();renderCustomers();$("cName").value="";$("cPhone").value="";toast("Customer saved")}
function renderCustomers(){$("customerTable").innerHTML=db.customers.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${c.bills}</td><td>${money(c.spent)}</td><td><button onclick="deleteCustomer('${c.id}')">Delete</button></td></tr>`).join("")||'<tr><td colspan="5" class="empty">No customers.</td></tr>'}
function deleteCustomer(id){db.customers=db.customers.filter(c=>c.id!==id);persist();renderCustomers()}
function renderSales(){
 let q=($("salesSearch")?.value||"").toLowerCase();let bs=db.bills.filter(b=>(b.no+" "+b.customer+" "+b.phone).toLowerCase().includes(q));
 $("salesTable").innerHTML=bs.map(b=>`<tr><td><b>${b.no}</b></td><td>${new Date(b.date).toLocaleString("en-IN")}</td><td>${esc(b.customer)}</td><td>${esc(b.payment)}</td><td>${money(b.total)}</td><td><button onclick='printBill(${JSON.stringify(b)})'>Print</button> <button class="red" onclick="deleteBill('${b.id}')">Delete</button></td></tr>`).join("")||'<tr><td colspan="6" class="empty">No bills found.</td></tr>'
}
function deleteBill(id){if(!confirm("Delete this saved bill? Stock will NOT be automatically restored."))return;db.bills=db.bills.filter(b=>b.id!==id);persist();renderSales();renderDashboard();renderLedger()}
function renderLedger(){let bs=db.bills.filter(b=>b.payment==="Credit / Udhaar"&&b.status!=="paid"),sum=bs.reduce((a,b)=>a+b.total,0);$("creditTotal").textContent=money(sum);$("ledgerTable").innerHTML=bs.map(b=>`<tr><td>${b.no}</td><td>${esc(b.customer)}</td><td>${esc(b.phone)}</td><td>${money(b.total)}</td><td>Unpaid</td><td><button class="green" onclick="markPaid('${b.id}')">Mark Paid</button></td></tr>`).join("")||'<tr><td colspan="6" class="empty">No pending udhaar.</td></tr>'}
function markPaid(id){let b=db.bills.find(x=>x.id===id);if(b){b.status="paid";b.payment="Cash / Paid";persist();renderLedger();renderSales();toast("Marked as paid")}}
function renderReports(){
 let f=$("fromDate")?.value,t=$("toDate")?.value,bs=db.bills.filter(b=>{let d=b.date.slice(0,10);return(!f||d>=f)&&(!t||d<=t)});
 let sales=bs.reduce((a,b)=>a+b.total,0);$("rSales").textContent=money(sales);$("rBills").textContent=bs.length;$("rAvg").textContent=money(bs.length?sales/bs.length:0);
 let m={};bs.forEach(b=>m[b.payment]=(m[b.payment]||0)+b.total);$("paymentReport").innerHTML=Object.entries(m).map(([k,v])=>`<div class="print-row"><span>${esc(k)}</span><b>${money(v)}</b></div>`).join("")||'<div class="empty">No sales in selected range.</div>'
}
function loadSettings(){let s=db.settings;$("sName").value=s.name;$("sPhone").value=s.phone;$("sUpi").value=s.upi;$("sAddress").value=s.address;$("sGstin").value=s.gstin;$("sFooter").value=s.footer}
function saveSettings(){db.settings={name:$("sName").value.trim()||"My General Store",phone:$("sPhone").value.trim(),upi:$("sUpi").value.trim(),address:$("sAddress").value.trim(),gstin:$("sGstin").value.trim(),footer:$("sFooter").value.trim()||"Thank you for shopping!"};persist();updateBrand();toast("Settings saved")}
function updateBrand(){$("brandName").textContent=db.settings.name;$("sideStore").textContent=db.settings.name}
function backup(){let blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="smartstore-backup.json";a.click();URL.revokeObjectURL(a.href)}
function restore(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{let x=JSON.parse(r.result);if(!x.products||!x.bills)throw Error();db=x;persist();location.reload()}catch{toast("Invalid backup file")}};r.readAsText(f)}
function exportCSV(){let rows=[["Bill","Date","Customer","Phone","Payment","Total"],...db.bills.map(b=>[b.no,new Date(b.date).toLocaleString("en-IN"),b.customer,b.phone,b.payment,b.total])];let csv=rows.map(r=>r.map(x=>`"${String(x??"").replaceAll('"','""')}"`).join(",")).join("\n"),a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="sales-history.csv";a.click()}
function resetData(){if(confirm("This will delete ALL products, bills, customers and settings stored in this browser. Continue?")){localStorage.removeItem(DBKEY);location.reload()}}

updateBrand();showPage("dashboard");