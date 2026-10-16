import { auth, db, ADMIN_EMAIL, SECOND_ADMIN_EMAIL } from "./firebase-config.js";
import { CALYPSO_SEED_RECIPES, makeSeedDocuments } from "./cocktail-seeds.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, onSnapshot, setDoc, addDoc, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = id => document.getElementById(id);
const allowed = email => [ADMIN_EMAIL, SECOND_ADMIN_EMAIL].some(x => x && String(x).toLowerCase() === String(email || "").toLowerCase());
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = v => String(v || "").trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const unitInfo = v => { const u=norm(v).replace(/\s/g,""); if(["ml","mililitro","mililitros"].includes(u))return["ml",1]; if(["l","lt","litro","litros"].includes(u))return["ml",1000]; if(["oz","onza","onzas","floz"].includes(u))return["ml",29.5735]; if(["g","gr","gramo","gramos"].includes(u))return["g",1]; if(["kg","kilo","kilos","kilogramo","kilogramos"].includes(u))return["g",1000]; if(["unidad","unidades","ud"].includes(u))return["unidades",1]; if(["cucharadita","cucharaditas","tsp"].includes(u))return["ml",5]; if(["cucharada","cucharadas","tbsp"].includes(u))return["ml",15]; return[u,1]; };
const convert = (n,from,to) => { const a=unitInfo(from),b=unitInfo(to); return a[0]===b[0]?n*a[1]/b[1]:null; };
let user=null, items=[], movements=[], stopInv=null, stopMoves=null, stream=null, scanTimer=null;
function status(msg,kind=""){const el=$("status");if(el){el.textContent=msg;el.className="notice"+(kind?" "+kind:"");}}
function ensureUI(){
 const inv=$("inventoryTab");
 if(inv && !$("cbEnhancements")){
  const box=document.createElement("div");box.id="cbEnhancements";box.className="panel";box.innerHTML=`
  <h2>Herramientas de inventario</h2>
  <div class="actions"><button class="btn secondary" id="cbExport">Exportar copia de seguridad</button><button class="btn secondary" id="cbImportButton">Importar copia de seguridad</button><input id="cbImportFile" type="file" accept="application/json,.json" hidden></div>
  <h3>Escáner de código de barras</h3><p class="muted">Lee EAN/UPC de la botella. Si el navegador no permite escanear, ingresa el código manualmente en el formulario de producto.</p>
  <div class="actions"><button class="btn" id="cbStartScan">Abrir cámara</button><button class="btn secondary" id="cbStopScan">Detener cámara</button></div><video id="cbVideo" playsinline muted style="display:none;width:100%;max-width:420px;border-radius:8px;margin-top:10px"></video><p id="cbScanStatus" class="muted" aria-live="polite"></p>
  <h3>Registrar movimiento</h3><div class="field-grid"><div><label for="cbProduct">Producto</label><select id="cbProduct"></select></div><div><label for="cbType">Tipo</label><select id="cbType"><option value="compra">Entrada / compra</option><option value="consumo">Consumo</option><option value="merma">Pérdida / merma</option><option value="ajuste">Ajuste manual (nueva existencia)</option></select></div><div><label for="cbAmount">Cantidad en unidad del producto</label><input id="cbAmount" type="number" min="0.001" step="any"></div><div class="field-full"><label for="cbNote">Nota</label><input id="cbNote" maxlength="250"></div></div><div class="actions"><button class="btn" id="cbSaveMove">Guardar movimiento</button></div>
  <h3>Historial de movimientos (últimos 100)</h3><div id="cbMovementList"><p class="muted">Cargando…</p></div>`;
  inv.appendChild(box);
 }
 const prep=$("prepareTab");
 if(prep && !$("cbConfirmPreparation")){
  const b=document.createElement("button");b.id="cbConfirmPreparation";b.type="button";b.className="btn";b.textContent="Confirmar preparación y descontar stock";b.style.marginTop="10px";
  const calc=$("calculatePortions");if(calc?.parentElement)calc.parentElement.appendChild(b);else prep.querySelector(".panel")?.appendChild(b);
 }
 const recipesTab=$("recipesTab");
 if(recipesTab && !$("cbSeedRecipes")){
  const seedBox=document.createElement("div");
  seedBox.className="panel";
  seedBox.id="cbSeedRecipes";
  seedBox.innerHTML='<h2>Catálogo inicial de cócteles</h2><p class="muted">Añade el catálogo ampliado de 87 cócteles y bebidas, con ingredientes públicos y método, cristalería y decoración privados. Las recetas existentes nunca se sobrescriben; si ya hay una receta con el mismo nombre, se omite para evitar duplicados.</p><div class="actions"><button class="btn" id="cbPublishSeeds" type="button">Agregar las 87 recetas</button></div><p id="cbSeedStatus" class="muted" aria-live="polite"></p><h3>Vista previa de las imágenes</h3><p class="muted">Estas fotos de referencia también se mostrarán en la carta pública cuando agregues las recetas.</p><div id="cbSeedGallery" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(125px,1fr));gap:12px"></div>';
  const firstPanel=recipesTab.querySelector(".panel");
  if(firstPanel)firstPanel.insertAdjacentElement("beforebegin",seedBox);else recipesTab.prepend(seedBox);
  const gallery=$("cbSeedGallery");
  if(gallery)gallery.innerHTML=CALYPSO_SEED_RECIPES.map(recipe=>'<div style="min-width:0;border:1px solid rgba(212,175,98,.3);border-radius:10px;overflow:hidden;background:#111"><img src="'+esc(recipe.photo)+'" alt="'+esc(recipe.name)+'" loading="lazy" style="display:block;width:100%;height:115px;object-fit:cover;background:#080808" onerror="this.style.display=\'none\';this.nextElementSibling.textContent=\'Imagen no disponible\'"><div style="padding:8px;font-size:15px;color:#f5f0e6">'+esc(recipe.name)+'</div></div>').join("");
 }
 const form=$("recipeForm");
 if(form && !$("cbStory")){
  const div=document.createElement("div");div.className="field-full";div.innerHTML='<label for="cbStory">Historia o reseña para la carta (editable)</label><textarea id="cbStory" maxlength="700" placeholder="Añade una historia breve para mostrar en la carta."></textarea><div class="actions"><button class="btn secondary" id="cbGenerateStory" type="button">Crear propuesta de reseña</button></div><p class="muted">Propuesta automática mediante plantilla local; no usa un servicio de IA externo.</p>';
  const photo=$("recipePhoto")?.closest(".field-full");if(photo?.parentElement)photo.insertAdjacentElement("afterend",div);else form.appendChild(div);
  $("cbGenerateStory").addEventListener("click",()=>{const name=$("recipeName").value.trim(),cat=$("recipeCategory").value.trim();if(!name){status("Escribe el nombre de la receta primero.","error");return;}const choices=["un perfil aromático y equilibrado","una combinación refrescante de sabores","una propuesta frutal llena de carácter","una mezcla suave con un final agradable"];const hash=[...name].reduce((a,c)=>a+c.charCodeAt(0),0);$("cbStory").value=name+" es "+choices[hash%choices.length]+(cat?", dentro de la categoría "+cat:"")+". Una propuesta de CALYPSO BAR para disfrutar sus ingredientes y compartir un momento especial.";status("Propuesta generada con plantilla local; edítala antes de guardar.","success");});
  $("recipeForm").addEventListener("submit",()=>{setTimeout(async()=>{const id=$("recipeId")?.value,story=$("cbStory")?.value.trim();if(!id||!user||!allowed(user.email))return;try{await setDoc(doc(db,"recipesPublic",id),{story,updatedAt:serverTimestamp(),updatedBy:user.uid},{merge:true});await setDoc(doc(db,"recipesPrivate",id),{story,updatedAt:serverTimestamp(),updatedBy:user.uid},{merge:true});}catch(e){console.error(e);status("La receta se guardó, pero no se pudo guardar la reseña.","error");}},900);});
  const oldEdit=window.editRecipe;
  $("clearRecipeForm")?.addEventListener("click",()=>{$("cbStory").value="";});
 }
}
function stopScan(){if(scanTimer)clearTimeout(scanTimer);scanTimer=null;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;const v=$("cbVideo");if(v){v.pause();v.srcObject=null;v.style.display="none";}}
function drawProducts(){const s=$("cbProduct");if(!s)return;const old=s.value;s.innerHTML=items.length?items.map(i=>'<option value="'+esc(i.id)+'">'+esc(i.name)+' ('+esc(i.unit||"")+")</option>").join(""):'<option value="">Primero registra productos</option>';if(items.some(i=>i.id===old))s.value=old;}
function drawMoves(){const el=$("cbMovementList");if(!el)return;el.innerHTML=movements.length?movements.map(m=>'<div class="inventory-item"><strong>'+esc(m.productName||"Producto")+'</strong><p>'+esc(m.type||"movimiento")+' · '+esc(m.amount??"")+' '+esc(m.unit||"")+'</p><p class="muted">'+esc(m.note||"")+' · '+esc(m.createdAt?.seconds?new Date(m.createdAt.seconds*1000).toLocaleString("es-CL"):"Fecha pendiente")+'</p></div>').join(""):'<p class="muted">Todavía no hay movimientos registrados.</p>';}
async function exportBackup(){const keys=["recipesPublic","recipesPrivate","inventory","inventoryMovements"];const vals=await Promise.all(keys.map(k=>getDocs(collection(db,k))));const out={format:"calypso-bar-backup-v1",exportedAt:new Date().toISOString()};keys.forEach((k,i)=>out[k]=vals[i].docs.map(d=>({id:d.id,...d.data()})));const blob=new Blob([JSON.stringify(out,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="calypso-bar-backup-"+new Date().toISOString().slice(0,10)+".json";a.click();URL.revokeObjectURL(url);status("Copia de seguridad exportada.","success");}
function wireUI(){
 const seedButton=$("cbPublishSeeds");
 if(seedButton && seedButton.dataset.wired!=="yes"){
  seedButton.dataset.wired="yes";
  seedButton.addEventListener("click",async()=>{
   if(!user||!allowed(user.email)){status("Inicia sesión con una cuenta autorizada para publicar recetas.","error");return;}
   if(!confirm("Se revisarán las 87 recetas. Las recetas que ya existan con el mismo nombre no se reemplazarán ni duplicarán. ¿Continuar?"))return;
   seedButton.disabled=true;
   const output=$("cbSeedStatus");
   if(output)output.textContent="Revisando recetas existentes y publicando las nuevas…";
   let created=0, skipped=[];
   try{
    const snap=await getDocs(collection(db,"recipesPublic"));
    const existingNames=new Set(snap.docs.map(d=>norm(d.data().name)));
    for(const recipe of CALYPSO_SEED_RECIPES){
     if(existingNames.has(norm(recipe.name))){skipped.push(recipe.name);continue;}
     const {publicData,privateData}=makeSeedDocuments(recipe);
     const id="calypso-seed-"+recipe.id;
     const oldPublic=await getDoc(doc(db,"recipesPublic",id));
     const oldPrivate=await getDoc(doc(db,"recipesPrivate",id));
     if(oldPublic.exists()||oldPrivate.exists()){skipped.push(recipe.name);continue;}
     publicData.updatedAt=serverTimestamp();
     publicData.updatedBy=user.uid;
     privateData.updatedAt=serverTimestamp();
     privateData.updatedBy=user.uid;
     await setDoc(doc(db,"recipesPrivate",id),privateData);
     await setDoc(doc(db,"recipesPublic",id),publicData);
     existingNames.add(norm(recipe.name));
     created++;
    }
    const summary="Importación terminada: "+created+" recetas nuevas publicadas."+(skipped.length?" Se omitieron por existir ya: "+skipped.join(", ")+".":"");
    if(output)output.textContent=summary;
    status(summary,created?"success":"");
   }catch(e){
    console.error(e);
    if(output)output.textContent="Se crearon "+created+" recetas antes del error. Pulsa de nuevo para continuar; las ya creadas no se sobrescribirán.";
    status("La importación se interrumpió. Revisa la conexión y las reglas de Firestore; puedes volver a intentarlo sin duplicar las recetas ya creadas.","error");
   }finally{seedButton.disabled=false;}
  });
 }

 $("cbStartScan")?.addEventListener("click",async()=>{const out=$("cbScanStatus"),v=$("cbVideo");if(!("BarcodeDetector"in window)){out.textContent="Este navegador no admite escáner integrado. Escribe el código EAN/UPC manualmente.";return;}try{const detector=new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e","code_128"]});stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});v.srcObject=stream;v.style.display="block";await v.play();out.textContent="Buscando código de barras…";const scan=async()=>{if(!stream)return;try{const codes=await detector.detect(v);if(codes.length&&codes[0].rawValue){const input=$("inventoryBarcode");if(input)input.value=codes[0].rawValue;out.textContent="Código leído: "+codes[0].rawValue+". Guarda el producto.";stopScan();return;}}catch(e){}scanTimer=setTimeout(scan,350);};scan();}catch(e){console.error(e);out.textContent="No se pudo abrir la cámara. Permite el acceso y usa HTTPS.";stopScan();}});
 $("cbStopScan")?.addEventListener("click",stopScan);
 $("cbSaveMove")?.addEventListener("click",async()=>{const item=items.find(i=>i.id===$("cbProduct").value),n=Number($("cbAmount").value),type=$("cbType").value;if(!user||!item||!Number.isFinite(n)||n<=0){status("Selecciona un producto y una cantidad válida.","error");return;}const after=type==="ajuste"?n:Number(item.quantity||0)+(type==="compra"?n:-n);if(after<0&&!confirm("El stock quedará bajo cero. ¿Continuar?"))return;try{await setDoc(doc(db,"inventory",item.id),{quantity:Number(after.toFixed(3)),updatedAt:serverTimestamp(),updatedBy:user.uid},{merge:true});await addDoc(collection(db,"inventoryMovements"),{productId:item.id,productName:item.name,type,amount:n,unit:item.unit,quantityBefore:item.quantity,quantityAfter:Number(after.toFixed(3)),note:$("cbNote").value.trim(),createdAt:serverTimestamp(),createdBy:user.uid});$("cbAmount").value="";$("cbNote").value="";status("Movimiento guardado.","success");}catch(e){console.error(e);status("No se pudo guardar el movimiento. Publica las reglas actualizadas.","error");}});
 $("cbExport")?.addEventListener("click",()=>exportBackup().catch(e=>{console.error(e);status("No se pudo exportar la copia de seguridad.","error");}));
 $("cbImportButton")?.addEventListener("click",()=>$("cbImportFile").click());
 $("cbImportFile")?.addEventListener("change",async ev=>{const f=ev.target.files?.[0];if(!f)return;if(!confirm("Se fusionarán los datos del archivo; no se borrarán los registros actuales. ¿Continuar?")){ev.target.value="";return;}try{const data=JSON.parse(await f.text());if(data.format!=="calypso-bar-backup-v1")throw Error("Formato inválido");let count=0;for(const key of ["recipesPublic","recipesPrivate","inventory","inventoryMovements"]){for(const row of (Array.isArray(data[key])?data[key]:[])){if(!row.id)continue;const{id,...payload}=row;await setDoc(doc(db,key,id),payload,{merge:true});count++;}}status("Copia fusionada; registros procesados: "+count+". No se borraron datos.","success");}catch(e){console.error(e);status("Archivo inválido o permisos insuficientes al importar.","error");}finally{ev.target.value="";}});
 $("cbConfirmPreparation")?.addEventListener("click",async()=>{if(!user||!allowed(user.email)){status("Inicia sesión como administrador.","error");return;}const id=$("prepareRecipeSelect")?.value,type=$("prepareVariantSelect")?.value,portions=Number($("portionCount")?.value);if(!id||!Number.isInteger(portions)||portions<1||portions>100){status("Elige receta y porciones válidas.","error");return;}try{const snap=await getDoc(doc(db,"recipesPublic",id)),pub=snap.exists()?snap.data():{},prSnap=await getDoc(doc(db,"recipesPrivate",id)),priv=prSnap.exists()?prSnap.data():{};const v=(Array.isArray(priv.variants)?priv.variants:[]).find(x=>x.type===type)||(Array.isArray(pub.variants)?pub.variants:[]).find(x=>x.type===type);if(!v||!Array.isArray(v.ingredients)){status("No se encontraron ingredientes para esa variante.","error");return;}const needs=[],skipped=[];for(const ing of v.ingredients){const n=Number(String(ing.amount??"").replace(",","."));if(!Number.isFinite(n)||n<=0)continue;const match=items.filter(i=>norm(i.name)===norm(ing.name));if(match.length!==1){skipped.push(ing.name);continue;}const item=match[0],qty=convert(n*portions,ing.unit,item.unit);if(qty===null){skipped.push(ing.name+" (unidad incompatible)");continue;}needs.push({item,qty});}const list=needs.map(x=>x.item.name+": -"+Number(x.qty.toFixed(3))+" "+x.item.unit).join("\n");if(!confirm("¿Confirmas preparar "+(pub.name||priv.name||"la receta")+" × "+portions+" porción(es)?\n\n"+(list||"No hay productos vinculados.")+(skipped.length?"\n\nNo se descontarán por falta de coincidencia exacta: "+skipped.join(", "):"")+"\n\nSe actualizará el stock y el historial."))return;if(!needs.length){status("No se descontó stock. Asegura que nombres de ingredientes y productos coincidan exactamente.","error");return;}if(needs.some(x=>Number(x.item.quantity||0)<x.qty)&&!confirm("Algún producto quedará bajo cero. ¿Continuar?"))return;for(const x of needs){const after=Number((Number(x.item.quantity||0)-x.qty).toFixed(3));await setDoc(doc(db,"inventory",x.item.id),{quantity:after,updatedAt:serverTimestamp(),updatedBy:user.uid},{merge:true});await addDoc(collection(db,"inventoryMovements"),{productId:x.item.id,productName:x.item.name,type:"consumo",amount:x.qty,unit:x.item.unit,quantityBefore:x.item.quantity,quantityAfter:after,note:"Preparación: "+(pub.name||priv.name||id)+" × "+portions,recipeId:id,portions,createdAt:serverTimestamp(),createdBy:user.uid});}status("Preparación registrada y stock descontado.","success");}catch(e){console.error(e);status("No se pudo registrar la preparación. Revisa reglas y conexión.","error");}});
}
onAuthStateChanged(auth, next=>{user=next;if(stopInv){stopInv();stopInv=null;}if(stopMoves){stopMoves();stopMoves=null;}if(!user||!allowed(user.email)){items=[];movements=[];stopScan();return;}ensureUI();wireUI();stopInv=onSnapshot(collection(db,"inventory"),s=>{items=s.docs.map(d=>({id:d.id,...d.data()}));drawProducts();},e=>console.error(e));stopMoves=onSnapshot(query(collection(db,"inventoryMovements"),orderBy("createdAt","desc"),limit(100)),s=>{movements=s.docs.map(d=>({id:d.id,...d.data()}));drawMoves();},e=>console.error(e));});
document.addEventListener("DOMContentLoaded",ensureUI);
