import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  Users, MessageSquare, Star, ArrowLeft, Shield, 
  Trash2, UserPlus, UserMinus, Search, Activity 
} from 'lucide-react';

export default function AdminDashboard({ session, onClose, language }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('stats'); // 'stats', 'users', 'feedback'
  const [feedbacks, setFeedbacks] = useState([]);
  const [stats, setStats] = useState({ 
    totalUsers: 0, 
    totalChats: 0, 
    chatsToday: 0, 
    mostActiveUser: '-',
    avgScore: 0 
  });
  const [myRole, setMyRole] = useState('sales');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    
    // 1. Ambil Role saya yang SEBENARNYA dari tabel account
    const { data: myProfile } = await supabase
      .from('account')
      .select('role')
      .eq('id', session.user.id)
      .single();
    
    if (myProfile) setMyRole(myProfile.role);

    await fetchData();
    setLoading(false);
  };

  const fetchData = async () => {
    try {
      // USERS
      const { data: usersData } = await supabase
        .from("account")
        .select("*")
        .order("created_at", { ascending: false });
  
      setUsers(usersData || []);
  
      // FEEDBACK
      const { data: feedbackData } = await supabase
        .from("feedbacks")
        .select("*")
        .order("created_at", { ascending: false });
  
      setFeedbacks(feedbackData || []);
  
      // CHAT STATS
      const { count: totalChats } = await supabase
        .from("chat_history")
        .select("*", { count: "exact", head: true });
  
      const today = new Date().toISOString().split("T")[0];
  
      const { count: chatsToday } = await supabase
        .from("chat_history")
        .select("*", { count: "exact", head: true })
        .gte("created_at", today);
  
      // MOST ACTIVE USER
      const { data: sessions } = await supabase
        .from("sessions")
        .select("user_id");
  
      let mostActive = "-";
      if (sessions?.length) {
        const counts = {};
        sessions.forEach(s => {
          counts[s.user_id] = (counts[s.user_id] || 0) + 1;
        });
  
        const topId = Object.keys(counts).reduce((a, b) =>
          counts[a] > counts[b] ? a : b
        );
  
        const { data: u } = await supabase
          .from("account")
          .select("full_name")
          .eq("id", topId)
          .single();
  
        if (u) mostActive = u.full_name;
      }
  
      setStats({
        totalUsers: usersData?.length || 0,
        totalChats: totalChats || 0,
        chatsToday: chatsToday || 0,
        mostActiveUser: mostActive,
        avgScore: 4.5
      });
  
    } catch (err) {
      console.error("Admin fetch error:", err);
    }
  };
      
      setUsers(usersRes.data);
      setFeedbacks(feedbackRes.data);
    } catch (err) {
      console.error(language === 'ID' ? "Gagal fetch data admin:" : "Failed to fetch admin data:", err);
    }
  };

  
  const handleUpdateRole = async (userId, newRole) => {
    if (myRole !== 'superadmin') {
      return alert(language === 'ID' ? "Hanya Superadmin yang bisa!" : "Only Superadmin can!");
    }

    const { error } = await supabase
      .from("account")
      .update({ role: newRole })
      .eq("id", userId);
  
    if (error) {
      alert(language === 'ID' ? "Gagal update role" : "Failed to update role");
    } else {
      alert(language === 'ID' ? "Role berhasil diupdate" : "Role has updated");
      fetchData();
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[60] bg-white dark:bg-gray-900 overflow-y-auto">
      {/* HEADER */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b dark:border-gray-800 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button onClick={onClose} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 transition-colors">
            <ArrowLeft size={20} />
            <span className="font-medium">{language === 'ID' ? 'Kembali ke Chat' : 'Back to Chat'}</span>
          </button>
          <div className="flex items-center gap-2">
            <Shield className="text-indigo-600" />
            <h1 className="text-xl font-bold dark:text-white">Admin Dashboard</h1>
          </div>
          <div className="w-24"></div> {/* Spacer */}
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-6">
        <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-fit gap-2 font-bold">
          <button 
            onClick={() => setActiveTab('stats')}
            className={`px-6 py-2 rounded-xl text-sm transition-all ${activeTab === 'stats' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600' : 'text-gray-500'}`}
          >
            {language === 'ID' ? 'Statistik' : 'Stats'}
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2 rounded-xl text-sm transition-all ${activeTab === 'users' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600' : 'text-gray-500'}`}
          >
            {language === 'ID' ? 'Pengguna' : 'Users'}
          </button>
          <button 
            onClick={() => setActiveTab('feedback')}
            className={`px-6 py-2 rounded-xl text-sm transition-all ${activeTab === 'feedback' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600' : 'text-gray-500'}`}
          >
            Feedback
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">

        {/* TAB STATISTIK */}
        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard 
              icon={<Activity className="text-green-600" />} 
              label={language === 'ID' ? "Chat Hari Ini" : "Chats Today"} 
              value={stats.chatsToday} 
              color="bg-green-50 dark:bg-green-900/20"
            />
            <StatCard 
              icon={<Users className="text-blue-600" />} 
              label={language === 'ID' ? "User Teraktif" : "Most Active"} 
              value={stats.mostActiveUser} 
              color="bg-blue-50 dark:bg-blue-900/20"
            />
            <StatCard 
              icon={<Star className="text-amber-600" />} 
              label={language === 'ID' ? "Rata-rata Skor" : "Avg Score"} 
              value={stats.avgScore} 
              color="bg-amber-50 dark:bg-amber-900/20"
            />
            <StatCard 
              icon={<Shield className="text-purple-600" />} 
              label="Role" 
              value={myRole.toUpperCase()} 
              color="bg-purple-50 dark:bg-purple-900/20"
            />
          </div>
        )}
      
        {/* TAB USER MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl border dark:border-gray-700 shadow-sm overflow-hidden">
      
            {/* HEADER */}
            <div className="p-6 border-b dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-lg font-bold dark:text-white">
                {language === 'ID' ? "Manajemen Pengguna" : "User Management"}
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text"
                  placeholder={language === 'ID' ? "Cari nama atau email..." : "Search name or email..."}
                  className="pl-10 pr-4 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full md:w-64"
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
      
            {/* TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Created</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold dark:text-white">{user.full_name || 'Anonymous'}</span>
                          <span className="text-xs text-gray-500">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-600">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {myRole === 'superadmin' && user.id !== session.user.id && (
                          <div className="flex gap-2">
                            <button onClick={() => handleUpdateRole(user.id,'admin')}>
                              <UserPlus size={16}/>
                            </button>
                            <button onClick={() => handleUpdateRole(user.id,'sales')}>
                              <UserMinus size={16}/>
                            </button>
                            <button className="text-red-600">
                              <Trash2 size={16}/>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      
        {/* TAB FEEDBACK */}
        {activeTab === 'feedback' && (
          <div className="grid grid-cols-1 gap-4">
            {feedbacks.map((fb) => (
              <div key={fb.id} className="p-6 bg-white dark:bg-gray-800 rounded-3xl border dark:border-gray-700 flex justify-between">
                <div>
                  <div className="font-bold">{fb.name}</div>
                  <div className="text-xs text-gray-500">{fb.email}</div>
                  <p className="text-sm mt-2 italic">"{fb.message}"</p>
                </div>
                <button className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold">
                  <Search size={14}/> Intip Chat
                </button>
              </div>
            ))}
          </div>
        )}
      
      </div>
    </div>
  );
}

// Sub-komponen untuk Card Statistik
function StatCard({ icon, label, value, color }) {
  return (
    <div className={`p-6 rounded-3xl border dark:border-gray-700 ${color} transition-transform hover:scale-[1.02]`}>
      <div className="flex items-center gap-4">
        <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm">
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
          <p className="text-2xl font-black dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}
