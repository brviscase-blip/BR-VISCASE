import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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
  ChevronLeft,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Settings
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MonthProvider, useMonth } from './contexts/MonthContext';

// Pages
import Dashboard from './pages/Dashboard';
import Contracts from './pages/Contracts';
import ContractDetails from './pages/ContractDetails';
import Team from './pages/Team';
import Financial from './pages/Financial';
import Home from './pages/Home';
import SettingsPage from './pages/Settings';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NavItem = ({ to, icon: Icon, label, active, onClick }: { to: string, icon: any, label: string, active: boolean, onClick?: () => void }) => (
  <Link
    to={to}
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 w-[148px] h-[37px] px-6 rounded-[6px] transition-all duration-200 group",
      active 
        ? "bg-[#c11720] text-white" 
        : "text-zinc-500 hover:bg-zinc-100 hover:text-black"
    )}
  >
    <Icon size={18} className={cn("transition-transform group-hover:scale-110", active ? "text-white" : "text-zinc-400")} />
    <span className="font-bold text-sm tracking-tight ml-[3px]">{label}</span>
  </Link>
);

const CurrentMonthIndicator = () => {
  const { monthLabel } = useMonth();
  if (!monthLabel) return null;
  return (
    <div className="flex items-center gap-2 bg-zinc-50 px-4 py-2 rounded-2xl border border-zinc-100">
      <Calendar size={18} className="text-[#c11720]" />
      <span className="font-bold text-sm text-[#0c3249] capitalize">{monthLabel}</span>
    </div>
  );
};
import { Calendar, Home as HomeIcon } from 'lucide-react';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { currentMonth } = useMonth();
  const { user, profile, signOut } = useAuth();

  if (!user || !profile) return null;

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FA] text-zinc-900 font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-50 w-full">
        <div className="w-full px-12 h-24 flex items-center justify-between">
          <div className="flex items-center gap-24">
            <div className="flex items-center gap-4">
              <img 
                src="https://lh3.googleusercontent.com/d/17CGqfWSpJkMTtlLnU4El8a5vAnXQyz56" 
                className="h-[50px] w-auto object-contain" 
                alt="Logo"
                referrerPolicy="no-referrer"
              />
            </div>

            <nav className="hidden lg:flex items-center gap-4">
              <NavItem to="/" icon={HomeIcon} label="Início" active={location.pathname === "/"} />
              {currentMonth && location.pathname !== "/" && (
                <>
                  <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" active={location.pathname === "/dashboard"} />
                  <NavItem to="/contratos" icon={FileText} label="Contratos" active={location.pathname.startsWith("/contratos")} />
                  <NavItem to="/team" icon={Users} label="Equipe" active={location.pathname === "/team"} />
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-10">
            {location.pathname !== "/" && <CurrentMonthIndicator />}
            <div className="hidden sm:flex items-center gap-5 px-6 py-3 bg-zinc-50 rounded-2xl border border-zinc-100">
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                alt="Avatar"
              />
              <div className="text-left">
                <p className="text-sm font-bold truncate max-w-[250px]">{user.displayName}</p>
                <p className="text-xs text-zinc-500 truncate max-w-[250px]">{profile.role}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {profile.role === 'ADM' && (
                <Link 
                  to="/settings"
                  className={cn(
                    "p-4 rounded-2xl transition-all flex items-center gap-3 font-bold text-sm",
                    location.pathname === '/settings' 
                      ? "text-[#c11720] bg-red-50" 
                      : "text-zinc-400 hover:text-[#c11720] hover:bg-red-50"
                  )}
                  title="Configurações"
                >
                  <Settings size={22} />
                </Link>
              )}
              <button 
                onClick={signOut}
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
          <NavItem to="/" icon={HomeIcon} label="Início" active={location.pathname === "/"} onClick={() => setIsMobileMenuOpen(false)} />
          {currentMonth && location.pathname !== "/" && (
            <>
              <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" active={location.pathname === "/dashboard"} onClick={() => setIsMobileMenuOpen(false)} />
              <NavItem to="/contratos" icon={FileText} label="Contratos" active={location.pathname.startsWith("/contratos")} onClick={() => setIsMobileMenuOpen(false)} />
              <NavItem to="/team" icon={Users} label="Equipe" active={location.pathname === "/team"} onClick={() => setIsMobileMenuOpen(false)} />
            </>
          )}
          {profile.role === 'ADM' && (
            <NavItem to="/settings" icon={Settings} label="Configurações" active={location.pathname === "/settings"} onClick={() => setIsMobileMenuOpen(false)} />
          )}
          <hr className="my-4 border-zinc-100" />
          <button onClick={signOut} className="flex items-center gap-3 px-4 py-3 text-red-600">
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-10 lg:p-16 w-full overflow-y-auto bg-[#F8F9FA]">
        {children}
      </main>
    </div>
  );
};

const Login = () => {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-6">
      <div className="w-full max-w-md bg-white rounded-none shadow-2xl shadow-black/5 p-10 text-center">
        <img 
          src="https://lh3.googleusercontent.com/d/17CGqfWSpJkMTtlLnU4El8a5vAnXQyz56" 
          className="h-[84px] w-auto mx-auto mb-8 object-contain" 
          alt="Logo"
          referrerPolicy="no-referrer"
        />
        <p className="text-zinc-500 mb-10 leading-relaxed">
          Gestão profissional de contratos, demandas e rentabilidade para agências e criativos.
        </p>
        <button 
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 bg-[#c11720] text-white py-4 rounded-2xl font-semibold hover:bg-red-800 transition-all active:scale-95"
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

const PendingApproval = () => {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-6">
      <div className="w-full max-w-md bg-white rounded-none shadow-2xl shadow-black/5 p-10 text-center">
        <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock size={40} />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-4">Aguardando Aprovação</h2>
        <p className="text-zinc-500 mb-8 leading-relaxed">
          Sua conta foi criada com sucesso, mas precisa ser aprovada por um administrador antes que você possa acessar o sistema.
        </p>
        <button 
          onClick={signOut}
          className="w-full flex items-center justify-center gap-3 bg-zinc-100 text-zinc-700 py-4 rounded-2xl font-semibold hover:bg-zinc-200 transition-all active:scale-95"
        >
          <LogOut size={20} />
          Sair
        </button>
      </div>
    </div>
  );
};

const RejectedAccess = () => {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-6">
      <div className="w-full max-w-md bg-white rounded-none shadow-2xl shadow-black/5 p-10 text-center">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-4">Acesso Negado</h2>
        <p className="text-zinc-500 mb-8 leading-relaxed">
          Infelizmente, seu acesso ao sistema foi negado por um administrador.
        </p>
        <button 
          onClick={signOut}
          className="w-full flex items-center justify-center gap-3 bg-zinc-100 text-zinc-700 py-4 rounded-2xl font-semibold hover:bg-zinc-200 transition-all active:scale-95"
        >
          <LogOut size={20} />
          Sair
        </button>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { currentMonth } = useMonth();
  const { profile } = useAuth();

  if (!currentMonth) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppContent = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-zinc-200 border-t-black rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) return <Login />;
  
  if (profile?.status === 'pending') return <PendingApproval />;
  if (profile?.status === 'rejected') return <RejectedAccess />;

  return (
    <Router>
      <MonthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/contratos" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
            <Route path="/contratos/:id" element={<ProtectedRoute><ContractDetails /></ProtectedRoute>} />
            <Route path="/team" element={<ProtectedRoute><Team /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute allowedRoles={['ADM']}><SettingsPage /></ProtectedRoute>} />
          </Routes>
        </Layout>
      </MonthProvider>
    </Router>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
