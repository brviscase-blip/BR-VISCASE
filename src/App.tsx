import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { auth, db } from './firebase';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  DollarSign, 
  PlusCircle, 
  LogOut, 
  Menu, 
  X, 
  ChevronRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Pages (to be created)
import Dashboard from './pages/Dashboard';
import Contracts from './pages/Contracts';
import ContractDetails from './pages/ContractDetails';
import Team from './pages/Team';
import Financial from './pages/Financial';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NavItem = ({ to, icon: Icon, label, active, onClick }: { to: string, icon: any, label: string, active: boolean, onClick?: () => void }) => (
  <Link
    to={to}
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-200 group",
      active 
        ? "bg-black text-white shadow-lg shadow-black/10" 
        : "text-zinc-500 hover:bg-zinc-100 hover:text-black"
    )}
  >
    <Icon size={20} className={cn("transition-transform group-hover:scale-110", active ? "text-white" : "text-zinc-400")} />
    <span className="font-bold text-sm tracking-tight">{label}</span>
  </Link>
);

const Layout = ({ children, user }: { children: React.ReactNode, user: User }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = () => signOut(auth);

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA] text-zinc-900 font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="w-full px-12 h-24 flex items-center justify-between">
          <div className="flex items-center gap-24">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white shadow-lg shadow-black/20">
                <DollarSign size={28} />
              </div>
              <h1 className="text-2xl font-black tracking-tighter hidden md:block">CreativeManager</h1>
            </div>

            <nav className="hidden lg:flex items-center gap-4">
              <NavItem to="/" icon={LayoutDashboard} label="Dashboard" active={location.pathname === "/"} />
              <NavItem to="/contracts" icon={FileText} label="Contratos" active={location.pathname.startsWith("/contracts")} />
              <NavItem to="/team" icon={Users} label="Equipe" active={location.pathname === "/team"} />
              <NavItem to="/financial" icon={DollarSign} label="Financeiro" active={location.pathname === "/financial"} />
            </nav>
          </div>

          <div className="flex items-center gap-10">
            <div className="hidden sm:flex items-center gap-5 px-6 py-3 bg-zinc-50 rounded-2xl border border-zinc-100">
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                alt="Avatar"
              />
              <div className="text-left">
                <p className="text-sm font-bold truncate max-w-[250px]">{user.displayName}</p>
                <p className="text-xs text-zinc-500 truncate max-w-[250px]">{user.email}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={handleSignOut}
                className="p-4 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all flex items-center gap-3 font-bold text-sm"
                title="Sair"
              >
                <LogOut size={22} />
                <span className="hidden xl:inline">Sair do Sistema</span>
              </button>

              <button className="lg:hidden p-3 bg-zinc-100 rounded-xl" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-white z-40 pt-24 px-6 flex flex-col gap-2">
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" active={location.pathname === "/"} onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem to="/contracts" icon={FileText} label="Contratos" active={location.pathname.startsWith("/contracts")} onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem to="/team" icon={Users} label="Equipe" active={location.pathname === "/team"} onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem to="/financial" icon={DollarSign} label="Financeiro" active={location.pathname === "/financial"} onClick={() => setIsMobileMenuOpen(false)} />
          <hr className="my-4 border-zinc-100" />
          <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-3 text-red-600">
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-10 lg:p-16 w-full">
        {children}
      </main>
    </div>
  );
};

const Login = () => {
  const handleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-black/5 p-10 text-center">
        <div className="w-20 h-20 bg-black rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-black/20">
          <DollarSign size={40} />
        </div>
        <h1 className="text-3xl font-bold mb-3 tracking-tight">CreativeManager</h1>
        <p className="text-zinc-500 mb-10 leading-relaxed">
          Gestão profissional de contratos, demandas e rentabilidade para agências e criativos.
        </p>
        <button 
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-black text-white py-4 rounded-2xl font-semibold hover:bg-zinc-800 transition-all active:scale-95"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Entrar com Google
        </button>
        <p className="mt-8 text-xs text-zinc-400">
          Ao entrar, você concorda com nossos termos de uso e política de privacidade.
        </p>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-zinc-200 border-t-black rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <Router>
      <Layout user={user}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/contracts/:id" element={<ContractDetails />} />
          <Route path="/team" element={<Team />} />
          <Route path="/financial" element={<Financial />} />
        </Routes>
      </Layout>
    </Router>
  );
}
