import {connect,countsFromBallots} from '../vote/client.mjs';
import {QUESTIONS,byId,LETTERS} from '../vote/questions.mjs';
const $=id=>document.getElementById(id);
let api,state,ballots={},stopBallots,pending=false;
for(const q of QUESTIONS){const o=document.createElement('option');o.value=q.id;o.textContent=q.label;$('question').append(o);}
const status=message=>{$('message').textContent=message;};
function render(){
  const q=byId[state?.questionId];if(!q)return;
  const aggregate=countsFromBallots(ballots,q.opts.length);$('total').textContent=`${aggregate.total}票 / 参加予定59名`;
  $('state').textContent=`${q.label}：${state.status==='open'?'受付中':'締切'}・集計${state.showResults?'表示中':'非表示'}`;
  $('bars').replaceChildren(...q.opts.map((label,i)=>{const p=document.createElement('p');p.textContent=`${LETTERS[i]} ${label}：${aggregate.counts[LETTERS[i]]}票`;return p;}));
  for(const id of ['open','close','reveal','hide'])$(id).disabled=pending;
  $('reveal').disabled=pending||state.status!=='closed';
}
async function action(fn){if(pending)return;pending=true;render();try{await fn();status('保存しました。');}catch(e){status(`操作できませんでした：${e.message}`);}finally{pending=false;render();}}
async function authorized(){
  const uid=api.auth.currentUser?.uid;if(!uid)return;
  const {ref,get,onValue}=api.dbSDK;
  const allowed=await get(ref(api.db,`lectureOperators/${uid}`));
  if(allowed.val()!==true){status(`先生の操作権限がまだありません。管理者にUIDを伝えて登録してください。UID: ${uid}`);return;}
  $('login').hidden=true;$('controls').hidden=false;status('先生として接続しています。');
  onValue(ref(api.db,`${api.room}/state`),s=>{
    const next=s.val();if(!byId[next?.questionId]){status('当日のroom初期データがありません。');return;}
    if(next.questionId!==state?.questionId){
      stopBallots?.();ballots={};$('question').value=next.questionId;
      stopBallots=onValue(ref(api.db,`${api.room}/ballots/${next.questionId}`),v=>{ballots=v.val()||{};render();},e=>status(e.message));
    }
    state=next;render();
  },e=>status(e.message));
}
try{
  api=await connect('teacher');const {ref,set,update,get}=api.dbSDK;
  $('environment').textContent=api.emulator?'ローカルエミュレータ · テスト用':api.test?'テスト部屋（本番とは別）':'本番 · 2026年10月7日 · 三輪田学園';
  $('login').hidden=false;
  $('login').onclick=async()=>{try{await api.authSDK.signInWithPopup(api.auth,new api.authSDK.GoogleAuthProvider());await authorized();}catch(e){status(e.message);}};
  if(api.auth.currentUser)await authorized();else status('先生のアカウントでログインしてください。');
  $('open').onclick=()=>action(()=>update(ref(api.db,api.room),{state:{questionId:$('question').value,status:'open',showResults:false},results:null}));
  $('close').onclick=()=>action(()=>update(ref(api.db,`${api.room}/state`),{status:'closed'}));
  $('hide').onclick=()=>action(()=>update(ref(api.db,api.room),{'state/showResults':false,results:null}));
  $('reveal').onclick=()=>action(async()=>{
    const current=(await get(ref(api.db,`${api.room}/state`))).val();
    if(current?.status!=='closed')throw new Error('先に投票を締め切ってください。');
    const q=byId[current.questionId],votes=(await get(ref(api.db,`${api.room}/ballots/${q.id}`))).val();
    const result={questionId:q.id,...countsFromBallots(votes,q.opts.length)};
    await update(ref(api.db,api.room),{results:result,'state/showResults':true});
  });
}catch(e){status(e.message);}
