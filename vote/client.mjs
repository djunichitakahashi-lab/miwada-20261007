import { runtime } from './runtime-config.mjs';
export async function connect(role = 'student') {
  const emulator = ['localhost','127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).get('emulator') === '1';
  const allowed=runtime.productionEnabled || (role==='teacher' && runtime.teacherSetupEnabled);
  if (!emulator && (!allowed || !runtime.firebaseConfig)) {
    throw new Error('投票はまだ準備中です。先生の案内をお待ちください。');
  }
  const [appSDK, dbSDK, authSDK] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js')
  ]);
  const config = emulator ? {apiKey:'demo-key',projectId:'demo-miwada-20261007',authDomain:'localhost',databaseURL:'https://demo-miwada-20261007-default-rtdb.firebaseio.com'} : runtime.firebaseConfig;
  const app = appSDK.initializeApp(config, role);
  const db = dbSDK.getDatabase(app), auth = authSDK.getAuth(app);
  if (emulator) {
    dbSDK.connectDatabaseEmulator(db,'127.0.0.1',9009);
    authSDK.connectAuthEmulator(auth,'http://127.0.0.1:9098',{disableWarnings:true});
  }
  await authSDK.setPersistence(auth,authSDK.browserSessionPersistence);
  await auth.authStateReady();
  if (role === 'student' && !auth.currentUser) await authSDK.signInAnonymously(auth);
  const test = new URLSearchParams(location.search).get('room') === 'test';
  return {db,auth,dbSDK,authSDK,emulator,test,room:`lectureRooms/${runtime.roomId}${test ? '-test' : ''}`};
}

export function countsFromBallots(ballots, count) {
  const counts=Object.fromEntries('ABCDEFG'.slice(0,count).split('').map(k=>[k,0]));
  for(const choice of Object.values(ballots || {})) {
    if(Number.isInteger(choice) && choice>=0 && choice<count) counts['ABCDEFG'[choice]]++;
  }
  return {counts,total:Object.values(counts).reduce((a,b)=>a+b,0)};
}
