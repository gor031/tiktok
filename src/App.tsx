import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Calendar, 
  Clock, 
  Image as ImageIcon, 
  Send, 
  CheckCircle2, 
  Timer, 
  LayoutDashboard, 
  LogOut, 
  User, 
  Heart, 
  MessageCircle, 
  Share2, 
  Music2,
  ChevronRight,
  ShieldCheck,
  Zap,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types for scheduled posts
interface ScheduledPost {
  id: string;
  imageUrl: string;
  caption: string;
  scheduledAt: string;
  status: 'pending' | 'completed';
}

export default function App() {
  const [isLoggedOut, setIsLoggedOut] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [posts, setPosts] = useState<ScheduledPost[]>([
    {
      id: '1',
      imageUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&q=80&w=400',
      caption: 'My first automated TikTok post! #automations #saas',
      scheduledAt: '2024-05-10 14:00',
      status: 'pending'
    },
    {
      id: '2',
      imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=400',
      caption: 'Gaming highlights coming soon 🎮 #gaming #tiktok',
      scheduledAt: '2024-05-09 10:30',
      status: 'completed'
    }
  ]);

  const [showLegal, setShowLegal] = useState<{ type: 'tos' | 'privacy' | 'cookie' | null }>({ type: null });

  const handleLogin = () => setIsLoggedOut(false);
  const handleLogout = () => setIsLoggedOut(true);

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl || !caption || !scheduledDate || !scheduledTime) return;

    const newPost: ScheduledPost = {
      id: Math.random().toString(36).substr(2, 9),
      imageUrl,
      caption,
      scheduledAt: `${scheduledDate} ${scheduledTime}`,
      status: 'pending'
    };

    setPosts([newPost, ...posts]);
    setImageUrl('');
    setCaption('');
  };

  return (
    <div className="min-h-screen bg-tiktok-black text-white font-sans selection:bg-tiktok-pink selection:text-white">
      <AnimatePresence mode="wait">
        {isLoggedOut ? (
          <LandingPage key="landing" onLogin={handleLogin} onOpenLegal={(type: 'tos' | 'privacy' | 'cookie') => setShowLegal({ type })} />
        ) : (
          <Dashboard 
            key="dashboard"
            posts={posts}
            imageUrl={imageUrl}
            setImageUrl={setImageUrl}
            caption={caption}
            setCaption={setCaption}
            scheduledDate={scheduledDate}
            setScheduledDate={setScheduledDate}
            scheduledTime={scheduledTime}
            setScheduledTime={setScheduledTime}
            onSchedule={handleSchedule}
            onLogout={handleLogout}
          />
        )}
      </AnimatePresence>

      <LegalModal 
        isOpen={showLegal.type !== null} 
        type={showLegal.type} 
        onClose={() => setShowLegal({ type: null })} 
      />
    </div>
  );
}

// --- Legal Modal Component ---
function LegalModal({ isOpen, type, onClose }: { isOpen: boolean, type: 'tos' | 'privacy' | 'cookie' | null, onClose: () => void }) {
  if (!type) return null;

  const getTitle = () => {
    switch(type) {
      case 'tos': return 'Terms of Service (이용약관)';
      case 'privacy': return 'Privacy Policy (개인정보 처리방침)';
      case 'cookie': return 'Cookie Policy (쿠키 정책)';
      default: return '';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-4xl max-h-[80vh] bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden flex flex-col shadow-2xl"
          >
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <h2 className="text-2xl font-bold">
                {getTitle()}
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="flex-grow overflow-y-auto p-8 prose prose-invert max-w-none prose-zinc prose-headings:text-tiktok-cyan prose-strong:text-tiktok-pink pb-20">
              {type === 'tos' ? (
                <div className="space-y-12">
                  <section>
                    <h3 className="text-xl font-bold border-b border-zinc-800 pb-2 mb-4">English version</h3>
                    <p><strong>Last Updated: May 1, 2026</strong></p>
                    <h4>1. Purpose</h4>
                    <p>These Terms of Service ("Terms") govern your access to and use of gabjagi ("the Service"), a TikTok automation tool that provides image/video scheduling and posting via the TikTok API.</p>
                    <h4>2. User Obligations</h4>
                    <p>Users must comply with all applicable local and international laws. You are responsible for maintaining the confidentiality of your account credentials.</p>
                    <h4>3. TikTok API Compliance</h4>
                    <p>By using gabjagi, you agree to strictly follow the TikTok Community Guidelines and TikTok Developer Policies. Any violation of TikTok's terms for content or behavior is the sole responsibility of the user.</p>
                    <h4>4. Automated Content Responsibility</h4>
                    <p>gabjagi is a tool for scheduling. The user holds 100% ownership and liability for any content published through the service. gabjagi does not endorse or review individual posts.</p>
                    <h4>5. Limitation of Liability</h4>
                    <p>gabjagi is provided "as is". We are not responsible for any account suspensions, shadows bans, or data loss resulting from the use of automated tools on TikTok's platform.</p>
                  </section>

                  <section className="bg-zinc-800/30 p-8 rounded-2xl">
                    <h3 className="text-xl font-bold border-b border-zinc-700 pb-2 mb-4">국문 (Korean)</h3>
                    <p><strong>최종 수정일: 2026년 5월 1일</strong></p>
                    <h4>1. 서비스의 목적</h4>
                    <p>이 약관은 틱톡(TikTok) API를 기반으로 이미지/영상 업로드 및 포스팅 예약 자동화를 제공하는 'gabjagi'(이하 "본 서비스")의 이용 조건 및 절차를 규정하는 것을 목적으로 합니다.</p>
                    <h4>2. 이용자의 의무</h4>
                    <p>이용자는 관련 법령과 이 약관을 준수해야 합니다. 계정 인증 및 비밀번호 관리에 대한 책임은 전적으로 이용자에게 있습니다.</p>
                    <h4>3. 틱톡 API 가이드라인 준수</h4>
                    <p>이용자는 본 서비스를 사용함에 있어 틱톡 커뮤니티 가이드라인 및 개발자 정책을 엄격히 준수해야 함에 동의합니다.</p>
                    <h4>4. 콘텐츠에 대한 책임</h4>
                    <p>본 서비스는 예약 및 자동 전송 도구만을 제공합니다. 자동화된 포스팅의 결과물과 그로 인한 분쟁에 대한 모든 책임은 이용자 본인에게 있습니다.</p>
                    <h4>5. 책임의 제한 및 면책</h4>
                    <p>본 서비스는 "있는 그대로" 제공됩니다. 당사는 이용자의 틱톡 계정 제재, 데이터 손실 또는 서비스 이용 중 발생한 결과에 대해 어떠한 법적 책임도 지지 않습니다.</p>
                  </section>
                </div>
              ) : type === 'privacy' ? (
                <div className="space-y-12">
                   <section>
                    <h3 className="text-xl font-bold border-b border-zinc-800 pb-2 mb-4">English version</h3>
                    <p><strong>Last Updated: May 1, 2026</strong></p>
                    <h4>1. Information We Collect</h4>
                    <ul>
                      <li>TikTok Account Data: OAuth Access Tokens and User IDs (via TikTok Login).</li>
                      <li>Media Content: Images and videos you upload for scheduling.</li>
                      <li>Schedule Settings: Time, date, and caption metadata.</li>
                    </ul>
                    <h4>2. Use of Data</h4>
                    <p>We use your data solely for facilitating the automated posting process requested by you. We do not sell or trade your data.</p>
                    <h4>3. Storage and Deletion</h4>
                    <p>OAuth tokens are encrypted and stored only for the duration of active sessions. Media files are deleted immediately after successful posting or upon manual deletion by the user.</p>
                    <h4>4. Third-Party Data Sharing (TikTok)</h4>
                    <p>Your content is transmitted to TikTok Inc. for the sole purpose of publishing. Please refer to TikTok's Privacy Policy for their handling practices.</p>
                    <h4>5. User Rights</h4>
                    <p>Users can request full data deletion by contacting us at <strong>gog031103@gmail.com</strong>. You can also revoke API access through your TikTok account settings.</p>
                  </section>

                  <section className="bg-zinc-800/30 p-8 rounded-2xl">
                    <h3 className="text-xl font-bold border-b border-zinc-700 pb-2 mb-4">국문 (Korean)</h3>
                    <p><strong>최종 수정일: 2026년 5월 1일</strong></p>
                    <h4>1. 수집하는 개인정보 항목</h4>
                    <ul>
                      <li>인증 정보: 틱톡 OAuth 액세스 토큰 및 계정 고유 ID.</li>
                      <li>콘텐츠 정보: 예약 업로드용 이미지 및 영상 파일.</li>
                      <li>설정 정보: 예약 시간, 날짜 및 캡션 텍스트.</li>
                    </ul>
                    <h4>2. 개인정보의 이용 목적</h4>
                    <p>수집된 정보는 이용자가 요청한 틱톡 자동 포스팅 기능을 수행하기 위한 목적으로만 사용됩니다.</p>
                    <h4>3. 정보의 보관 및 파기</h4>
                    <p>액세스 토큰은 암호화되어 보관되며, 서비스 해지 시 즉시 파기됩니다. 업로드된 미디어 파일은 포스팅 완료 후 즉시 서버에서 삭제됩니다.</p>
                    <h4>4. 제3자 제공 (TikTok)</h4>
                    <p>이용자가 예약한 포스팅을 수행하기 위해 틱톡(TikTok Inc.) 측에 데이터를 전송합니다. 이는 서비스 핵심 기능 제공을 위함입니다.</p>
                    <h4>5. 이용자의 권리</h4>
                    <p>이용자는 언제든지 <strong>gog031103@gmail.com</strong>을 통해 본인의 데이터 삭제를 요청하거나, 틱톡 설정에서 API 권한을 철회할 수 있습니다.</p>
                  </section>
                </div>
              ) : (
                <div className="space-y-12">
                  <section>
                    <h3 className="text-xl font-bold border-b border-zinc-800 pb-2 mb-4">English version</h3>
                    <p><strong>Last Updated: May 1, 2026</strong></p>
                    <h4>1. Introduction</h4>
                    <p>This Cookie Policy explains how gabjagi uses cookies to provide, secure, and improve our services.</p>
                    <h4>2. What are Cookies?</h4>
                    <p>Cookies are small text files stored on your browser when you visit our website.</p>
                    <h4>3. Types of Cookies We Use</h4>
                    <ul>
                      <li><strong>Strictly Necessary Cookies:</strong> Required for account authentication (OAuth) and maintaining your login session.</li>
                      <li><strong>Functionality Cookies:</strong> Used to remember your dashboard preferences and temporary upload states.</li>
                    </ul>
                    <h4>4. No Tracking for Advertising</h4>
                    <p>gabjagi does NOT use cookies for third-party advertising or cross-site tracking. We prioritize your privacy and strictly use functional cookies.</p>
                  </section>

                  <section className="bg-zinc-800/30 p-8 rounded-2xl">
                    <h3 className="text-xl font-bold border-b border-zinc-700 pb-2 mb-4">국문 (Korean)</h3>
                    <p><strong>최종 수정일: 2026년 5월 1일</strong></p>
                    <h4>1. 개요</h4>
                    <p>본 쿠키 정책은 gabjagi가 서비스를 제공, 보안 및 개선하기 위해 쿠키를 사용하는 방법을 설명합니다.</p>
                    <h4>2. 쿠키란 무엇인가요?</h4>
                    <p>쿠키는 웹사이트 방문 시 브라우저에 저장되는 작은 텍스트 파일입니다.</p>
                    <h4>3. 사용하는 쿠키의 종류</h4>
                    <ul>
                      <li><strong>필수 쿠키:</strong> 계정 인증(OAuth) 및 로그인 세션 유지를 위해 반드시 필요합니다.</li>
                      <li><strong>기능 쿠키:</strong> 대시보드 설정 및 임시 업로드 상태를 기억하는 데 사용됩니다.</li>
                    </ul>
                    <h4>4. 광고 및 추적 금지</h4>
                    <p>gabjagi는 제3자 광고나 타 사이트 추적을 위한 쿠키를 사용하지 않습니다. 당사는 이용자의 프라이버시를 우선하며 서비스 기능 제공을 위한 쿠키만을 최소한으로 사용합니다.</p>
                  </section>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// --- Landing Page Component ---
function LandingPage({ onLogin, onOpenLegal }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-screen px-4 py-20 relative overflow-hidden"
    >
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-tiktok-pink/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-tiktok-cyan/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="fixed top-0 w-full z-50 px-6 py-6 flex justify-between items-center max-w-7xl">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <span className="text-tiktok-black font-bold text-xl tracking-tighter">g</span>
          </div>
          <span className="text-2xl font-bold tracking-tight">gabjagi</span>
        </div>
        <button 
          onClick={onLogin}
          id="btn-login-header"
          className="bg-white text-tiktok-black hover:bg-zinc-200 px-6 py-2.5 rounded-full font-bold transition-all flex items-center gap-2 group"
        >
          Login with TikTok
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </header>

      {/* Hero Section */}
      <div className="max-w-4xl text-center z-10">
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-6xl md:text-8xl font-black tracking-tight mb-8 leading-[0.95]"
        >
          EFFORTLESS <span className="text-tiktok-pink">TIKTOK</span> <br />
          <span className="text-tiktok-cyan">AUTOMATION</span>
        </motion.h1>
        
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-xl md:text-2xl text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed"
        >
          틱톡 포스팅, 이제 자동으로 관리하세요. 이미지와 영상을 예약하고 
          실시간 미리보기로 완벽한 콘텐츠를 구성하세요.
        </motion.p>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col md:flex-row gap-4 justify-center"
        >
          <button 
            onClick={onLogin}
            id="btn-get-started"
            className="px-10 py-5 bg-tiktok-pink hover:bg-tiktok-pink/90 text-white rounded-full font-bold text-xl transition-all shadow-[0_0_20px_rgba(254,44,85,0.3)]"
          >
            Get Started Now
          </button>
          <button className="px-10 py-5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full font-bold text-xl transition-all">
            See Dashboard
          </button>
        </motion.div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-40 max-w-7xl w-full">
        {[
          { icon: <ShieldCheck className="w-8 h-8"/>, title: "Secure Access", desc: "TikTok Official API integration for maximum security." },
          { icon: <Zap className="w-8 h-8"/>, title: "Lightning Fast", desc: "Instantly schedule dozens of posts in minutes." },
          { icon: <Globe className="w-8 h-8"/>, title: "Global Reach", desc: "Smart scheduling based on your audience timezone." }
        ].map((f, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-8 bg-zinc-900/50 border border-zinc-800 rounded-3xl"
          >
            <div className="text-tiktok-cyan mb-4">{f.icon}</div>
            <h3 className="text-2xl font-bold mb-2">{f.title}</h3>
            <p className="text-zinc-500 leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <footer className="mt-40 border-t border-zinc-800 pt-20 pb-10 w-full max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
                <span className="text-tiktok-black font-bold">g</span>
              </div>
              <span className="text-xl font-bold">gabjagi</span>
            </div>
            <p className="text-zinc-500 max-w-xs">
              Automating your creative journey on TikTok. Built for creators, by creators.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-6 text-zinc-300 uppercase tracking-widest text-xs">Legal</h4>
            <ul className="space-y-4 text-zinc-500">
              <li><button onClick={() => onOpenLegal('tos')} className="hover:text-white transition-colors">Terms of Service</button></li>
              <li><button onClick={() => onOpenLegal('privacy')} className="hover:text-white transition-colors">Privacy Policy</button></li>
              <li><button onClick={() => onOpenLegal('cookie')} className="hover:text-white transition-colors">Cookie Policy</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6 text-zinc-300 uppercase tracking-widest text-xs">Support</h4>
            <ul className="space-y-4 text-zinc-500">
              <li><a href="mailto:gog031103@gmail.com" className="hover:text-white transition-colors">gog031103@gmail.com</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
            </ul>
          </div>
        </div>
        <div className="text-zinc-700 text-sm flex justify-between border-t border-zinc-900 pt-8">
          <span>&copy; 2024 gabjagi. All rights reserved.</span>
          <div className="flex gap-6">
            <span className="hover:text-zinc-400 cursor-pointer">Twitter</span>
            <span className="hover:text-zinc-400 cursor-pointer">TikTok</span>
          </div>
        </div>
      </footer>
    </motion.div>
  );
}

// --- Dashboard Component ---
function Dashboard({ 
  posts, 
  imageUrl, setImageUrl, 
  caption, setCaption, 
  scheduledDate, setScheduledDate, 
  scheduledTime, setScheduledTime,
  onSchedule,
  onLogout
}: any) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex min-h-screen bg-[#080808]"
    >
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 bg-zinc-950 border-r border-zinc-900 flex flex-col items-center lg:items-stretch p-4 gap-8">
        <div className="flex items-center gap-3 px-2 py-4">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shrink-0">
            <span className="text-tiktok-black font-bold text-xl tracking-tighter">g</span>
          </div>
          <span className="hidden lg:block text-xl font-bold tracking-tight">gabjagi</span>
        </div>

        <nav className="flex flex-col gap-2 flex-grow">
          <SidebarItem icon={<LayoutDashboard />} label="Dashboard" active />
          <SidebarItem icon={<Calendar />} label="Schedule" />
          <SidebarItem icon={<ImageIcon />} label="Assets" />
          <SidebarItem icon={<User />} label="Account" />
        </nav>

        <button 
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-3 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-xl transition-all mt-auto"
        >
          <LogOut className="w-6 h-6" />
          <span className="hidden lg:block font-medium">Log out</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-grow flex flex-col h-screen overflow-hidden">
        {/* Topbar */}
        <header className="h-20 border-b border-zinc-900 px-8 flex items-center justify-between bg-[#080808]/80 backdrop-blur-md sticky top-0 z-20">
          <h2 className="text-2xl font-bold">Creator Studio</h2>
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-tiktok-pink to-tiktok-cyan p-[2px]">
              <div className="h-full w-full rounded-full bg-zinc-900 flex items-center justify-center font-bold text-xs">JD</div>
            </div>
          </div>
        </header>

        {/* Dynamic Content Scrollable Area */}
        <div className="flex-grow overflow-y-auto p-8 grid grid-cols-1 xl:grid-cols-12 gap-8 custom-scrollbar">
          {/* Left Column: Forms & Lists */}
          <div className="xl:col-span-8 flex flex-col gap-8">
            
            {/* Upload Area */}
            <section className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-3xl" id="upload-section">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Plus className="text-tiktok-pink" /> 
                New Automation Post
              </h3>
              <form onSubmit={onSchedule} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-zinc-500 ml-1">Image URL</label>
                  <div className="relative">
                    <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 w-5 h-5" />
                    <input 
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 focus:border-tiktok-cyan focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-zinc-500 ml-1">Schedule date & Time</label>
                  <div className="flex gap-2">
                    <input 
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="flex-grow bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-4 focus:border-tiktok-cyan focus:outline-none transition-all color-scheme-dark"
                    />
                    <input 
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-32 bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-4 focus:border-tiktok-cyan focus:outline-none transition-all color-scheme-dark"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="text-sm font-semibold text-zinc-500 ml-1">Caption</label>
                  <textarea 
                    placeholder="Enter your viral caption here..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={4}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 focus:border-tiktok-cyan focus:outline-none transition-all resize-none"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <button 
                    type="submit"
                    className="bg-white text-tiktok-black hover:bg-tiktok-cyan transition-all px-12 py-4 rounded-full font-bold flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" /> Schedule Automation
                  </button>
                </div>
              </form>
            </section>

            {/* Schedule List */}
            <section className="bg-zinc-900/40 border border-zinc-800 p-8 rounded-3xl">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Timer className="text-tiktok-cyan" /> 
                  Upcoming Schedule
                </h3>
                <span className="text-zinc-500 text-sm">{posts.length} posts scheduled</span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-zinc-500 text-xs uppercase tracking-widest font-bold">
                      <th className="px-6 py-4">Preview</th>
                      <th className="px-6 py-4">Caption</th>
                      <th className="px-6 py-4">Time</th>
                      <th className="px-6 py-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((post: ScheduledPost) => (
                      <tr key={post.id} className="bg-zinc-950/50 hover:bg-zinc-900 transition-colors group">
                        <td className="px-6 py-4 rounded-l-2xl">
                          <img src={post.imageUrl} alt="" className="w-16 h-20 object-cover rounded-lg border border-zinc-800 group-hover:scale-105 transition-transform" />
                        </td>
                        <td className="px-6 py-4">
                          <p className="line-clamp-2 text-zinc-300 text-sm max-w-[200px]">{post.caption}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-zinc-600" />
                            {post.scheduledAt}
                          </div>
                        </td>
                        <td className="px-6 py-4 rounded-r-2xl text-center">
                          {post.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-xs font-bold ring-1 ring-inset ring-green-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Published
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-tiktok-cyan/10 text-tiktok-cyan rounded-full text-xs font-bold ring-1 ring-inset ring-tiktok-cyan/20">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Right Column: Live Mockup */}
          <div className="xl:col-span-4 flex flex-col items-center">
            <div className="sticky top-28 w-full max-w-[340px]">
              <h3 className="text-xl font-bold mb-6 text-center">Live Preview</h3>
              
              {/* Phone Mockup */}
              <div className="relative aspect-[9/19] w-full bg-zinc-950 rounded-[3rem] border-[8px] border-zinc-900 shadow-[0_0_80px_rgba(37,244,238,0.05)] overflow-hidden">
                {/* Content */}
                <div className="absolute inset-0 flex flex-col">
                  {/* Background Content */}
                  <div className="flex-grow bg-zinc-900 relative">
                    {imageUrl ? (
                      <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 bg-zinc-900">
                        <ImageIcon className="w-12 h-12 mb-2" />
                        <span className="text-xs">No image provided</span>
                      </div>
                    )}
                    
                    {/* UI Overlays */}
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent pt-20">
                      <div className="flex items-end justify-between">
                        <div className="flex-grow pr-8">
                          <p className="font-bold text-sm mb-1">@gabjagi_creator</p>
                          <p className="text-sm line-clamp-3 leading-tight opacity-90">
                            {caption || "Add a caption to see how it looks here..."}
                          </p>
                          <div className="flex items-center gap-2 mt-4 text-xs">
                            <Music2 className="w-3 h-3" /> Original Audio - gabjagi
                          </div>
                        </div>
                        
                        {/* Status Icons */}
                        <div className="flex flex-col gap-6 items-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-12 h-12 rounded-full bg-zinc-950/20 backdrop-blur-md flex items-center justify-center">
                              <Heart className="w-7 h-7 fill-white" />
                            </div>
                            <span className="text-[10px] font-bold">128K</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-12 h-12 rounded-full bg-zinc-950/20 backdrop-blur-md flex items-center justify-center">
                              <MessageCircle className="w-7 h-7 fill-white" />
                            </div>
                            <span className="text-[10px] font-bold">2.4K</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-12 h-12 rounded-full bg-zinc-950/20 backdrop-blur-md flex items-center justify-center">
                              <Share2 className="w-7 h-7 fill-white" />
                            </div>
                            <span className="text-[10px] font-bold">582</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Bar */}
                <div className="absolute top-0 inset-x-0 h-10 px-6 flex justify-between items-center text-[10px] font-bold z-30">
                  <span>9:41</span>
                  <div className="flex gap-1.5 items-center">
                    <div className="w-3.5 h-3.5 border-2 border-white rounded-sm rotate-[25deg]" />
                    <div className="w-4 h-2 bg-white rounded-sm" />
                  </div>
                </div>

                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-zinc-900 rounded-b-2xl z-40" />
              </div>
              
              <p className="text-zinc-600 text-xs mt-6 text-center px-4">
                This shows the mobile version of the TikTok feed interface.
              </p>
            </div>
          </div>
        </div>
      </main>
    </motion.div>
  );
}

function SidebarItem({ icon, label, active = false }: { icon: any, label: string, active?: boolean }) {
  return (
    <div className={`
      flex items-center gap-3 px-4 py-4 rounded-2xl cursor-pointer transition-all group
      ${active ? 'bg-tiktok-pink text-white shadow-lg shadow-tiktok-pink/20' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'}
    `}>
      <span className="w-6 h-6">{icon}</span>
      <span className="hidden lg:block font-bold tracking-tight">{label}</span>
    </div>
  );
}
