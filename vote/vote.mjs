import {connect} from './client.mjs';
import {byId,LETTERS} from './questions.mjs';
const $=id=>document.getElementById(id);
let api,state=null,connected=false,pending=false,myChoice=null,stopChoice=null;
function render(){
  const q=byId[state?.questionId];
  const open=state?.status==='open';
  // Before the teacher starts (closed, no results, not yet voted), show only a waiting message.
  if(!q||!(open||state?.showResults===true||myChoice!=null)){
    $('state').textContent='先生の案内をお待ちください';
    $('question').textContent='今日の予想を、スマホから。';
    $('options').replaceChildren();
    return;
  }
  $('state').textContent=open?'回答を受付中':'回答は締め切りました';
  $('question').textContent=q.title;
  $('options').replaceChildren(...q.opts.map((label,i)=>{
    const button=document.createElement('button');button.className='choice';button.type='button';
    button.disabled=!connected||pending||state.status!=='open';button.setAttribute('aria-pressed',String(myChoice===i));
    const key=document.createElement('span');key.className='letter';key.textContent=LETTERS[i];
    const text=document.createElement('span');text.textContent=label;button.append(key,text);
    button.onclick=()=>cast(state.questionId,i);return button;
  }));
}
async function cast(qid,choice){
  if(pending||!connected||state.status!=='open')return;
  pending=true;$('message').textContent='送信中…';render();
  try{
    await api.dbSDK.set(api.dbSDK.ref(api.db,`${api.room}/ballots/${qid}/${api.auth.currentUser.uid}`),choice);
    if(state?.questionId===qid){myChoice=choice;$('message').textContent=`${LETTERS[choice]}で回答しました。受付中は変更できます。`;}
  }catch{$('message').textContent='送信できませんでした。締切または通信状態を確認してください。';}
  finally{pending=false;render();}
}
function results(data){
  const q=byId[state?.questionId];
  $('results').hidden=!(state?.showResults&&data&&data.questionId===state.questionId&&q);
  if($('results').hidden)return;
  $('bars').replaceChildren(...q.opts.map((label,i)=>{
    const row=document.createElement('div');row.className='bar-row';
    const name=document.createElement('span');name.textContent=`${LETTERS[i]} ${label}`;
    const num=document.createElement('span');const n=Number(data.counts?.[LETTERS[i]])||0;num.textContent=`${n}票`;
    const track=document.createElement('div');track.className='bar-track';const fill=document.createElement('div');fill.className='bar-fill';fill.style.width=`${data.total?n/data.total*100:0}%`;track.append(fill);row.append(name,num,track);return row;
  }));
}
try{
  api=await connect();const {ref,onValue}=api.dbSDK;let lastResults=null;
  onValue(ref(api.db,'.info/connected'),s=>{connected=s.val()===true;$('connection').textContent=connected?'接続しています':'通信が切れています。回答はまだ送らないでください。';render();});
  onValue(ref(api.db,`${api.room}/state`),s=>{
    const previous=state?.questionId;state=s.val();
    if(previous!==state?.questionId){
      stopChoice?.();myChoice=null;$('message').textContent='';
      if(byId[state?.questionId])stopChoice=onValue(ref(api.db,`${api.room}/ballots/${state.questionId}/${api.auth.currentUser.uid}`),v=>{myChoice=v.val();render();},()=>{$('message').textContent='回答の確認に失敗しました。';});
    }
    render();results(lastResults);
  },()=>{$('connection').textContent='投票の設定を確認できません。先生へお知らせください。';connected=false;render();});
  onValue(ref(api.db,`${api.room}/results`),s=>{lastResults=s.val();results(lastResults);});
}catch(e){$('connection').textContent=e.message;$('connection').classList.add('error');}
