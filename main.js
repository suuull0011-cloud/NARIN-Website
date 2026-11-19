const DB='narinLittleArchive', STORE='entries';
let db, entries=[], editingId=null, pendingMedia=[], pendingHero=null, pendingHeroes=[], activeFilter='all', heroBlob=null, heroTimer=null, heroIndex=0, detailEntry=null, detailIndex=0, splashTimer=null; let navItems=[];
const $=id=>document.getElementById(id);
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,2);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:'id'});if(!d.objectStoreNames.contains('hero'))d.createObjectStore('hero',{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function tx(mode='readonly'){return db.transaction(STORE,mode).objectStore(STORE)}
function allEntries(){return new Promise((resolve,reject)=>{const r=tx().getAll();r.onsuccess=()=>resolve(r.result.sort((a,b)=>(b.date||'').localeCompare(a.date||'')));r.onerror=()=>reject(r.error);});}
function put(item){return new Promise((resolve,reject)=>{const r=tx('readwrite').put(item);r.onsuccess=resolve;r.onerror=()=>reject(r.error);});}
function del(id){return new Promise((resolve,reject)=>{const r=tx('readwrite').delete(id);r.onsuccess=resolve;r.onerror=()=>reject(r.error);});}
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2200);}
function imgURL(blob){return blob?URL.createObjectURL(blob):'';}
function safe(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function safeHttpLink(value){
    if(!value) return '';

    try{
        const url = new URL(String(value).trim());

        if(url.protocol === 'http:' || url.protocol === 'https:'){
            return url.href;
        }

        return '';
    }catch{
        return '';
    }
}
function entryMedia(item){
 return item?.media?.length?item.media:(item?.images?.length?item.images:(item?.image?[item.image]:[]));
}
function isVideo(file){return !!file?.type?.startsWith('video/');}
function categoryLabel(id){return navItems.find(x=>x.id===id)?.label||String(id||'').toUpperCase();}
function render(){
 const list=activeFilter==='all'?entries:entries.filter(e=>e.category===activeFilter);
 $('count').textContent=list.length+' ITEMS';
 $('sectionTitle').textContent=activeFilter==='all'?'Little memories':categoryLabel(activeFilter);
 $('gallery').className='grid'+((activeFilter==='moment'||activeFilter==='diary')?' layout-stream':'');
 $('gallery').innerHTML=list.length?list.map(e=>{
  const media=entryMedia(e), first=media[0];
  const postLink=safeHttpLink(e.link);

const linkButton=postLink
 ? `<a class="tiny-link"
      href="${safe(postLink)}"
      target="_blank"
      rel="noopener noreferrer"
      onclick="event.stopPropagation()">
      打开链接 ↗
    </a>`
 : '';
  let cover='✧';
  if(first){
   const url=imgURL(first);
   cover=isVideo(first)
    ? `<video src="${url}" autoplay muted loop playsinline preload="metadata"></video><span class="video-mark">VIDEO</span>`
    : `<img src="${url}" alt="">`;
  }
  return `<article class="card"><div class="cover" onclick="openDetail('${e.id}')">${cover}</div><div class="card-body" onclick="openDetail('${e.id}')"><div class="date">${safe(e.date||'A SPECIAL DAY')} · ${safe(categoryLabel(e.category))}</div><h3>${safe(e.title)}</h3><p>${safe(e.description)}</p></div><div class="card-actions">
${linkButton}
<button class="tiny" onclick="event.stopPropagation();editEntry('${e.id}')">编辑</button>
<button class="tiny" onclick="event.stopPropagation();deleteEntry('${e.id}')">删除</button>
</div></article>`;
 }).join(''):`<div class="empty">这里还空着，等待你放进喜欢的照片和故事。<br>点击右下角「＋」开始收藏 ✧</div>`;
}
function showDetailMedia(){
 if(!detailEntry)return;
 const media=entryMedia(detailEntry), current=media[detailIndex];
 const image=$('detailImage'), video=$('detailVideo');
 video.pause();video.removeAttribute('src');video.load();
 image.removeAttribute('src');
 if(current){
  $('detailStage').style.display='flex';
  if(isVideo(current)){
   image.style.display='none';video.style.display='block';video.src=imgURL(current);video.load();
  }else{
   video.style.display='none';image.style.display='block';image.src=imgURL(current);
  }
 }else{
  $('detailStage').style.display='none';
 }
 $('detailCount').textContent=media.length?(detailIndex+1)+' / '+media.length:'暂无媒体';
 $('detailPrev').style.display=media.length>1?'block':'none';
 $('detailNext').style.display=media.length>1?'block':'none';
}
function openDetail(id){
 detailEntry=entries.find(x=>x.id===id);if(!detailEntry)return;
 detailIndex=0;
 $('detailDate').textContent=(detailEntry.date||'A SPECIAL DAY')+' · '+categoryLabel(detailEntry.category).toUpperCase();
 $('detailTitle').textContent=detailEntry.title||'';
 $('detailDescription').textContent=detailEntry.description||'';
 const postLink=safeHttpLink(detailEntry.link);
const linkElement=$('detailLink');

linkElement.href=postLink;
linkElement.hidden=!postLink;
 showDetailMedia();
 $('detailOverlay').classList.add('show');
}
function moveDetail(step){
 if(!detailEntry)return;
 const media=entryMedia(detailEntry);
 if(!media.length)return;
 detailIndex=(detailIndex+step+media.length)%media.length;
 showDetailMedia();
}
function showEntry(item){
 editingId=item?.id||null;
 pendingMedia=entryMedia(item).slice();
 $('entryHeading').textContent=item?'Edit a memory':'Add a memory';
 updateCategoryOptions(item?.category||navItems.find(x=>x.id!=='all')?.id||'photo');
 $('title').value=item?.title||'';
 $('date').value=item?.date||new Date().toISOString().slice(0,10);
 $('description').value=item?.description||'';$('postLink').value=item?.link||'';
 renderPreviews(pendingMedia,'previewStrip');
 $('mediaFile').value='';
 $('entryOverlay').classList.add('show');
}
function renderPreviews(files,target){
 const box=$(target);box.innerHTML='';
 (files||[]).forEach((file,i)=>{
  const wrap=document.createElement('div');wrap.className='preview-item';
  const url=imgURL(file);let mediaEl;
  if(isVideo(file)){mediaEl=document.createElement('video');mediaEl.src=url;mediaEl.muted=true;mediaEl.playsInline=true;mediaEl.preload='metadata';}
  else{mediaEl=document.createElement('img');mediaEl.src=url;mediaEl.alt='图片预览';}
  const rm=document.createElement('button');rm.type='button';rm.className='preview-remove';rm.textContent='×';rm.title='移除此文件';
  rm.onclick=()=>{
   if(target==='previewStrip'){pendingMedia.splice(i,1);renderPreviews(pendingMedia,target);}
   else{pendingHeroes.splice(i,1);renderPreviews(pendingHeroes,target);}
  };
  wrap.append(mediaEl,rm);box.appendChild(wrap);
 });
}

window.editEntry=id=>{const e=entries.find(x=>x.id===id);if(e)showEntry(e)};
window.deleteEntry=async id=>{if(confirm('确定删除这条内容吗？')){await del(id);await refresh();toast('已删除');}};
async function refresh(){entries=await allEntries();render();}
$('mediaFile').addEventListener('change',e=>{
 const selected=Array.from(e.target.files).filter(f=>f.type.startsWith('image/')||f.type.startsWith('video/'));
 if(!selected.length)return toast('请选择图片、GIF 或视频文件');
 pendingMedia=[...pendingMedia,...selected];
 renderPreviews(pendingMedia,'previewStrip');
 e.target.value='';
});
$('entryForm').addEventListener('submit',async e=>{
 e.preventDefault();
  const rawLink=$('postLink').value.trim();
 const postLink=safeHttpLink(rawLink);

 if(rawLink && !postLink){
  toast('请输入有效的网址，网址需要以 https:// 或 http:// 开头');
  return;
 }
 const old=entries.find(x=>x.id===editingId);
 const item={
  id:editingId||crypto.randomUUID(),
  category:$('category').value,
  title:$('title').value.trim(),
  date:$('date').value,
  description:$('description').value.trim(),
  link:postLink,
  media:pendingMedia.slice(),
  images:pendingMedia.filter(f=>!isVideo(f)),
  image:pendingMedia.find(f=>!isVideo(f))||null,
  created:old?.created||Date.now()
 };
 await put(item);$('entryOverlay').classList.remove('show');await refresh();toast('已保存这份回忆');
});
const baseNav=[
 {id:'all',label:'全部',fixed:true},
 {id:'photo',label:'PHOTO',builtin:true},
 {id:'moment',label:'MOMENTS',builtin:true},
 {id:'diary',label:'DIARY',builtin:true}
];
function loadNav(){
 try{
  const saved=JSON.parse(localStorage.getItem('narinNavV5')||'null');
  if(Array.isArray(saved)){
   const valid=saved.filter(x=>x&&typeof x.id==='string'&&typeof x.label==='string');
   const all=valid.find(x=>x.id==='all')||baseNav[0];
   const result=[{...all,id:'all',fixed:true},...valid.filter(x=>x.id!=='all')];
   baseNav.slice(1).forEach(base=>{if(!result.some(x=>x.id===base.id))result.push(base);});
   return result;
  }
 }catch{}
 let old={};try{old=JSON.parse(localStorage.getItem('narinTabs')||'{}')||{};}catch{}
 return baseNav.map(x=>({...x,label:old[x.id]||x.label}));
}
navItems=loadNav();
function updateCategoryOptions(selected){
 const select=$('category');select.innerHTML='';
 navItems.filter(x=>x.id!=='all').forEach(item=>{
  const option=document.createElement('option');option.value=item.id;option.textContent=item.label;select.appendChild(option);
 });
 select.value=navItems.some(x=>x.id===selected)?selected:(navItems.find(x=>x.id!=='all')?.id||'photo');
}
function renderTabs(){
 const holder=$('tabs');holder.innerHTML='';
 navItems.forEach(item=>{
  const button=document.createElement('button');button.type='button';button.dataset.filter=item.id;button.textContent=item.label;
  if(activeFilter===item.id)button.classList.add('active');
  button.onclick=()=>{
   activeFilter=item.id;
   holder.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===button));
   render();
  };
  holder.appendChild(button);
 });
}
function applyTabs(){renderTabs();}
function renderTabsEditor(){
 const holder=$('tabsEditor');holder.innerHTML='';
 navItems.filter(x=>x.id!=='all').forEach((item,index)=>{
  const row=document.createElement('div');row.className='nav-editor-row';
  const input=document.createElement('input');input.maxLength=18;input.value=item.label;input.setAttribute('aria-label','栏目名称');
  input.oninput=()=>{item.label=input.value;};
  const actions=document.createElement('div');actions.className='nav-editor-actions';
  const up=document.createElement('button');up.type='button';up.textContent='↑';up.title='上移';up.disabled=index===0;up.onclick=()=>{const at=navItems.findIndex(x=>x.id===item.id);[navItems[at-1],navItems[at]]=[navItems[at],navItems[at-1]];renderTabsEditor();};
  const down=document.createElement('button');down.type='button';down.textContent='↓';down.title='下移';down.disabled=index===navItems.length-2;down.onclick=()=>{const at=navItems.findIndex(x=>x.id===item.id);[navItems[at+1],navItems[at]]=[navItems[at],navItems[at+1]];renderTabsEditor();};
  actions.append(up,down);
  if(!item.builtin){
   const delButton=document.createElement('button');delButton.type='button';delButton.textContent='删除';delButton.onclick=async()=>{
    const destination=navItems.find(x=>x.id!=='all'&&x.id!==item.id);
    const related=entries.filter(entry=>entry.category===item.id);
    if(related.length&&destination){
     for(const entry of related)await put({...entry,category:destination.id});
    }
    navItems=navItems.filter(x=>x.id!==item.id);
    if(activeFilter===item.id)activeFilter='all';
    renderTabsEditor();applyTabs();await refresh();
   };
   actions.appendChild(delButton);
  }
  row.append(input,actions);holder.appendChild(row);
 });
}
$('editTabs').onclick=()=>{$('newTabName').value='';renderTabsEditor();$('tabsOverlay').classList.add('show');};
$('addTab').onclick=()=>{
 const name=$('newTabName').value.trim();
 if(!name)return toast('先输入栏目名称');
 if(navItems.some(x=>x.label.toLowerCase()===name.toLowerCase()))return toast('已经有同名栏目了');
 navItems.push({id:'custom-'+crypto.randomUUID(),label:name});
 $('newTabName').value='';renderTabsEditor();toast('栏目已添加，记得保存设置');
};
$('saveTabs').onclick=()=>{
 navItems=navItems.map(x=>({...x,label:x.label.trim()||x.id.toUpperCase()}));
 localStorage.setItem('narinNavV5',JSON.stringify(navItems));
 applyTabs();updateCategoryOptions($('category').value);
 $('tabsOverlay').classList.remove('show');toast('导航设置已保存');
};

$('editHome').onclick=()=>{pendingHeroes=[];const hr=db.transaction('hero').objectStore('hero').getAll();hr.onsuccess=()=>{pendingHeroes=hr.result.sort((a,b)=>a.id-b.id).map(x=>x.blob);renderPreviews(pendingHeroes,'heroPreviewStrip');};$('homeName').value=$('heroName').textContent;$('homeSub').value=$('heroSub').textContent;$('homeIntro').value=$('introText').innerText.replace('\n','\n');$('homeTextColor').value=getComputedStyle(document.documentElement).getPropertyValue('--page-text-color').trim()||'#392D43';$('homeOverlay').classList.add('show');};
$('heroFile').addEventListener('change',e=>{pendingHeroes=[...pendingHeroes,...Array.from(e.target.files).filter(f=>f.type.startsWith('image/'))];renderPreviews(pendingHeroes,'heroPreviewStrip');});
function renderHeroSlides(files){const holder=$('heroSlides');holder.innerHTML='';files.forEach((f,i)=>{const slide=document.createElement('div');slide.className='hero-slide';const im=document.createElement('img');im.src=imgURL(f);im.alt='NARIN 图片 '+(i+1);slide.appendChild(im);holder.appendChild(slide);});heroIndex=0;buildHeroDots(files.length);startHeroCarousel();}
function buildHeroDots(n){$('heroDots').innerHTML='';for(let i=0;i<n;i++){const b=document.createElement('button');b.className='hero-dot'+(i===0?' active':'');b.onclick=()=>moveHero(i);$('heroDots').appendChild(b);}}
function moveHero(i){const n=$('heroSlides').children.length;if(!n)return;heroIndex=(i+n)%n;$('heroSlides').style.transform=`translateX(-${heroIndex*100}%)`;document.querySelectorAll('.hero-dot').forEach((d,j)=>d.classList.toggle('active',j===heroIndex));}
function startHeroCarousel(){clearInterval(heroTimer);if($('heroSlides').children.length>1)heroTimer=setInterval(()=>moveHero(heroIndex+1),3500);}
function saveHeroSlides(files){renderHeroSlides(files);const t=db.transaction('hero','readwrite');const st=t.objectStore('hero');st.clear();files.forEach((blob,i)=>st.put({id:i,blob}));}
$('saveHome').onclick=()=>{const n=$('homeName').value.trim()||'NARIN';$('heroName').textContent=n;$('heroSub').textContent=$('homeSub').value;$('introText').innerText=$('homeIntro').value;const textColor=$('homeTextColor').value;document.documentElement.style.setProperty('--page-text-color',textColor);saveHeroSlides(pendingHeroes);pendingHeroes=[];localStorage.setItem('narinHome',JSON.stringify({name:n,sub:$('homeSub').value,intro:$('homeIntro').value,textColor}));$('homeOverlay').classList.remove('show');toast('主页设置已保存');};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$ (b.dataset.close).classList.remove('show'));

$('addEntry').addEventListener('click',()=>showEntry());
document.querySelector('.section-head').addEventListener('click',()=>showEntry());
document.querySelector('.section-head').style.cursor='pointer';
$('closeDetail').onclick=()=>{$('detailVideo').pause();$('detailOverlay').classList.remove('show');};
$('detailPrev').onclick=()=>moveDetail(-1);$('detailNext').onclick=()=>moveDetail(1);
let touchStartX=0,touchStartY=0;
$('detailStage').addEventListener('touchstart',e=>{touchStartX=e.touches[0].clientX;touchStartY=e.touches[0].clientY;},{passive:true});
$('detailStage').addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-touchStartX,dy=e.changedTouches[0].clientY-touchStartY;if(Math.abs(dx)>35&&Math.abs(dx)>Math.abs(dy))moveDetail(dx<0?1:-1);},{passive:true});
function enterMain(){clearTimeout(splashTimer);$('splashOverlay').classList.remove('show');}
function showSplash(){
 $('splashName').textContent=$('heroName').textContent||'NARIN';
 const first=$('heroSlides').querySelector('img');if(first){$('splashImage').src=first.src;$('splashImage').style.display='block';}else{$('splashImage').style.display='none';}
 $('splashOverlay').classList.add('show');
 splashTimer=setTimeout(enterMain,6000);
}
let splashStartY=0;
$('splashScreen').addEventListener('touchstart',e=>{splashStartY=e.touches[0].clientY;},{passive:true});
$('splashScreen').addEventListener('touchend',e=>{if(splashStartY-e.changedTouches[0].clientY>35)enterMain();},{passive:true});
$('splashScreen').addEventListener('wheel',e=>{if(e.deltaY>0)enterMain();},{passive:true});
$('splashScreen').addEventListener('click',enterMain);
(async()=>{try{applyTabs();updateCategoryOptions('photo');db=await openDB();const saved=JSON.parse(localStorage.getItem('narinHome')||'null');if(saved){$('heroName').textContent=saved.name;$('heroSub').textContent=saved.sub;$('introText').innerText=saved.intro;if(saved.textColor){document.documentElement.style.setProperty('--page-text-color',saved.textColor);$('homeTextColor').value=saved.textColor;}}await refresh();try{const hr=db.transaction('hero').objectStore('hero').getAll();hr.onsuccess=()=>{const hs=hr.result.sort((a,b)=>a.id-b.id).map(x=>x.blob);if(hs.length)renderHeroSlides(hs);setTimeout(showSplash,120);};}catch(e){setTimeout(showSplash,120);}}catch(e){toast('浏览器暂不支持本地保存');}})();