import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

export default function Login() {
     const [username, setUsername] = useState('');
     const [password, setPassword] = useState('');
     const [error, setError] = useState('');
     const [isLoading, setIsLoading] = useState(false);

     const navigate = useNavigate();
     const location = useLocation();
     const { login } = useAuthStore();

     const from = location.state?.from?.pathname || '/';

     const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          setIsLoading(true);
          setError('');

          try {
               // Backend OptiPlan360 standart auth rotasi
               const response = await api.post('/api/v1/auth/login', {
                    username,
                    password,
               });

               const { token, user } = response.data;

               // Sadece müşteri rolüne izin ver
               if (user.role !== 'CUSTOMER') {
                    setError('Bu portal sadece Müşteri (B2B/B2C) hesaplarına açıktır.');
                    setIsLoading(false);
                    return;
               }

               login(token, user);
               navigate(from, { replace: true });
          } catch (err: any) {
               setError(err.response?.data?.error?.message || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
          } finally {
               setIsLoading(false);
          }
     };

     return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
               <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-glass border border-gray-100">
                    <div>
                         <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 border-b pb-4">
                              OptiPlan360 Müşteri Portalı
                         </h2>
                         <p className="mt-2 text-center text-sm text-gray-600">
                              Siparişlerinizi ve hesap ekstrelernizi takip etmek için giriş yapın.
                         </p>
                    </div>
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                         {error && (
                              <div className="bg-red-50 border-l-4 border-red-500 p-4 text-sm text-red-700">
                                   {error}
                              </div>
                         )}
                         <div className="rounded-md shadow-sm -space-y-px">
                              <div>
                                   <label htmlFor="username" className="sr-only">Kullanıcı Adı</label>
                                   <input
                                        id="username"
                                        name="username"
                                        type="text"
                                        required
                                        className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                                        placeholder="Kullanıcı Adı"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                   />
                              </div>
                              <div>
                                   <label htmlFor="password" className="sr-only">Şifre</label>
                                   <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        required
                                        className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                                        placeholder="Şifre"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                   />
                              </div>
                         </div>

                         <div>
                              <button
                                   type="submit"
                                   disabled={isLoading}
                                   className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-300"
                              >
                                   {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                              </button>
                         </div>
                         <div className="flex items-center justify-center mt-4">
                              <div className="text-sm">
                                   <Link to="/forgot-password" className="font-medium text-primary-600 hover:text-primary-500">
                                        Şifremi unuttum
                                   </Link>
                              </div>
                         </div>
                    </form>
               </div>
          </div>
     );
}
