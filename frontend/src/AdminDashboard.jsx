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
  const [stats, setStats] = useState({ totalUsers: 0, totalChats: 0, totalFeedback: 0 });
  const myRole = session.user.user_metadata.role || 'admin';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // 1. Ambil Data User (dari tabel profiles yang kita buat di Step 1)
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    // 2. Ambil Statistik Sederhana
    const { count: chatCount } = await supabase.from('chat_history').select('*', { count: 'exact', head: true });
    
    if (!error) {
      setUsers(profiles);
      setStats({
        totalUsers: profiles.length,
        totalChats: chatCount || 0,
        totalFeedback: 0 // Anda bisa fetch dari tabel feedback jika sudah ada
      });
    }
    setLoading(false);
  };

  const handleUpdateRole = async (userId, newRole) => {
    if (myRole !== 'superadmin') return alert("Hanya Superadmin yang bisa mengubah role!");
    
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (!error) fetchData();
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

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard 
            icon={<Users className="text-blue-600" />} 
            label={language === 'ID' ? "Total Pengguna" : "Total Users"} 
            value={stats.totalUsers} 
            color="bg-blue-50 dark:bg-blue-900/20"
          />
          <StatCard 
            icon={<MessageSquare className="text-green-600" />} 
            label={language === 'ID' ? "Total Percakapan" : "Total Chats"} 
            value={stats.totalChats} 
            color="bg-green-50 dark:bg-green-900/20"
          />
          <StatCard 
            icon={<Activity className="text-amber-600" />} 
            label={language === 'ID' ? "Role Anda" : "Your Role"} 
            value={myRole.toUpperCase()} 
            color="bg-amber-50 dark:bg-amber-900/20"
          />
        </div>

        {/* USER TABLE SECTION */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl border dark:border-gray-700 shadow-sm overflow-hidden">
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

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold dark:text-white">{user.full_name || 'Anonymous'}</span>
                        <span className="text-xs text-gray-500">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                        user.role === 'superadmin' ? 'bg-purple-100 text-purple-600' : 
                        user.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {myRole === 'superadmin' && user.id !== session.user.id && (
                          <>
                            {user.role === 'sales' ? (
                              <button 
                                onClick={() => handleUpdateRole(user.id, 'admin')}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                title="Promote to Admin"
                              >
                                <UserPlus size={18} />
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleUpdateRole(user.id, 'sales')}
                                className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg"
                                title="Demote to Sales"
                              >
                                <UserMinus size={18} />
                              </button>
                            )}
                            <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
