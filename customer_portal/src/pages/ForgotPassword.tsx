import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function ForgotPassword() {
     const [email, setEmail] = useState('');
     const [loading, setLoading] = useState(false);
     const [success, setSuccess] = useState(false);
     const [error, setError] = useState('');

     const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          if (!email) return;

          try {
               setLoading(true);
               setError('');
               await api.post('/auth/forgot-password', { email });
               setSuccess(true);
          } catch (err: any) {
               setError(err.response?.data?.detail || "Bir hata oluştu, lütfen e-posta adresinizi kontrol edin.");
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
                         Şifremi Unuttum
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                         Lütfen sisteme kayıtlı e-posta adresinizi girin. <br />
                         Şifre sıfırlama bağlantısı e-posta adresinize gönderilecektir.
                    </p>
               </div>

               <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
                         {success ? (
                              <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
                                   <div className="flex">
                                        <div className="flex-shrink-0">
                                             <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                             </svg>
                                        </div>
                                        <div className="ml-3">
                                             <p className="text-sm text-green-700">
                                                  Eğer e-posta sistemimizde kayıtlı ise, şifre sıfırlama bağlantısı gönderilmiştir. Lütfen spam kutunuzu da kontrol ediniz.
                                             </p>
                                        </div>
                                   </div>
                                   <div className="mt-6 text-center">
                                        <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
                                             Giriş ekranına dön
                                        </Link>
                                   </div>
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
                                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                             E-posta Adresi
                                        </label>
                                        <div className="mt-1">
                                             <input
                                                  id="email"
                                                  name="email"
                                                  type="email"
                                                  autoComplete="email"
                                                  required
                                                  value={email}
                                                  onChange={(e) => setEmail(e.target.value)}
                                                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                  placeholder="ornek@firma.com"
                                             />
                                        </div>
                                   </div>

                                   <div>
                                        <button
                                             type="submit"
                                             disabled={loading}
                                             className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                                        >
                                             {loading ? 'Gönderiliyor...' : 'Bağlantı Gönder'}
                                        </button>
                                   </div>

                                   <div className="text-center text-sm">
                                        <span className="text-gray-600">Şifrenizi hatırladınız mı?</span>{' '}
                                        <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
                                             Giriş Yap
                                        </Link>
                                   </div>
                              </form>
                         )}
                    </div>
               </div>
          </div>
     );
}
