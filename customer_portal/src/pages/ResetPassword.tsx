import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

export default function ResetPassword() {
     const [searchParams] = useSearchParams();
     const token = searchParams.get('token');
     const navigate = useNavigate();

     const [password, setPassword] = useState('');
     const [confirmPassword, setConfirmPassword] = useState('');
     const [loading, setLoading] = useState(false);
     const [error, setError] = useState('');
     const [success, setSuccess] = useState(false);

     useEffect(() => {
          if (!token) {
               setError('Geçersiz veya eksik sıfırlama bağlantısı.');
          }
     }, [token]);

     const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          if (!token) return;

          if (password !== confirmPassword) {
               setError('Şifreler uyuşmuyor.');
               return;
          }

          if (password.length < 6) {
               setError('Yeni şifre en az 6 karakter olmalıdır.');
               return;
          }

          try {
               setLoading(true);
               setError('');
               await api.post('/auth/reset-password', {
                    token,
                    new_password: password
               });
               setSuccess(true);

               // 3 Saniye sonra login ekranına at
               setTimeout(() => {
                    navigate('/login');
               }, 3000);

          } catch (err: any) {
               setError(err.response?.data?.detail || "Şifre sıfırlanırken bir hata oluştu. Bağlantının süresi dolmuş olabilir.");
          } finally {
               setLoading(false);
          }
     };

     return (
          <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
               <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="flex justify-center mb-6">
                         <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                              <span className="text-2xl font-bold text-white tracking-wider">O3</span>
                         </div>
                    </div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                         Yeni Şifre Belirleme
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                         Lütfen hesabınız için yeni ve güvenli bir şifre girin.
                    </p>
               </div>

               <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
                         {success ? (
                              <div className="bg-green-50 border-l-4 border-green-400 p-4 text-center">
                                   <h3 className="text-lg font-medium text-green-800 mb-2">Başarılı!</h3>
                                   <p className="text-sm text-green-700">
                                        Şifreniz başarıyla güncellendi. Giriş ekranına yönlendiriliyorsunuz...
                                   </p>
                              </div>
                         ) : (
                              <form className="space-y-6" onSubmit={handleSubmit}>
                                   {error && (
                                        <div className="bg-red-50 border-l-4 border-red-400 p-4">
                                             <div className="flex">
                                                  <div className="flex-shrink-0">
                                                       <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                       </svg>
                                                  </div>
                                                  <div className="ml-3">
                                                       <p className="text-sm text-red-700">{error}</p>
                                                  </div>
                                             </div>
                                        </div>
                                   )}

                                   <div>
                                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                             Yeni Şifre
                                        </label>
                                        <div className="mt-1">
                                             <input
                                                  id="password"
                                                  name="password"
                                                  type="password"
                                                  required
                                                  disabled={!token}
                                                  value={password}
                                                  onChange={(e) => setPassword(e.target.value)}
                                                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                             />
                                        </div>
                                   </div>

                                   <div>
                                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                                             Şifreyi Tekrar Girin
                                        </label>
                                        <div className="mt-1">
                                             <input
                                                  id="confirmPassword"
                                                  name="confirmPassword"
                                                  type="password"
                                                  required
                                                  disabled={!token}
                                                  value={confirmPassword}
                                                  onChange={(e) => setConfirmPassword(e.target.value)}
                                                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                             />
                                        </div>
                                   </div>

                                   <div>
                                        <button
                                             type="submit"
                                             disabled={loading || !token}
                                             className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                                        >
                                             {loading ? 'Güncelleniyor...' : 'Şifreyi Kaydet'}
                                        </button>
                                   </div>

                                   <div className="text-center mt-4">
                                        <Link to="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                                             Giriş ekranına dön
                                        </Link>
                                   </div>
                              </form>
                         )}
                    </div>
               </div>
          </div>
     );
}
