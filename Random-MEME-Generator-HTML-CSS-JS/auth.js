// Simple client-side auth for demo purposes (uses localStorage)
(function(){
  const USERS_KEY = 'rmg_users';
  const SESSION_KEY = 'rmg_session';

  function getUsers(){
    try{ return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }catch(e){ return []; }
  }
  function saveUsers(users){ localStorage.setItem(USERS_KEY, JSON.stringify(users)); }

  function setSession(user){ localStorage.setItem(SESSION_KEY, JSON.stringify(user)); }
  function clearSession(){ localStorage.removeItem(SESSION_KEY); }
  function getSession(){ try{ return JSON.parse(localStorage.getItem(SESSION_KEY)); }catch(e){return null;} }

  function hashPass(p){ try{ return btoa(p); }catch(e){ return p; } }

  // exposed API
  window.Auth = {
    register: function({name, email, password}){
      if(!email || !password) return { ok:false, message:'Email and password required' };
      const users = getUsers();
      if(users.find(u=>u.email === email)) return { ok:false, message:'User already exists' };
      const user = { id: Date.now().toString(36), name: name || email.split('@')[0], email, password: hashPass(password) };
      users.push(user); saveUsers(users); setSession({ id:user.id, name:user.name, email:user.email });
      return { ok:true, user };
    },
    login: function({email, password}){
      const users = getUsers();
      const hp = hashPass(password);
      const u = users.find(x => x.email === email && x.password === hp);
      if(!u) return { ok:false, message: 'Invalid credentials' };
      setSession({ id:u.id, name:u.name, email:u.email });
      return { ok:true, user: { id:u.id, name:u.name, email:u.email } };
    },
    logout: function(){ clearSession(); },
    current: function(){ return getSession(); }
  };

  // populate auth area on index page
  function renderAuthArea(){
    const el = document.getElementById('auth-area');
    if(!el) return;
    el.innerHTML = '';
    const user = getSession();
    if(user){
      const name = document.createElement('span'); name.textContent = 'Hi, ' + (user.name || user.email);
      const logout = document.createElement('button'); logout.textContent = 'Logout'; logout.className = 'generate-meme-btn';
      logout.addEventListener('click', ()=>{ clearSession(); renderAuthArea(); window.location.href = 'login.html'; });
      el.appendChild(name); el.appendChild(logout);
    } else {
      const lnk = document.createElement('a'); lnk.href = 'login.html'; lnk.textContent = 'Login'; lnk.style.marginRight = '8px';
      const rlnk = document.createElement('a'); rlnk.href = 'register.html'; rlnk.textContent = 'Register';
      el.appendChild(lnk); el.appendChild(rlnk);
    }
  }

  // Run on DOM ready
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderAuthArea);
  else renderAuthArea();

})();
