import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { HomeIcon, ShoppingCartIcon, DocumentTextIcon, LifebuoyIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

const navigation = [
     { name: 'Dashboard', href: '/', icon: HomeIcon },
     { name: 'Siparişlerim', href: '/orders', icon: ShoppingCartIcon },
     { name: 'Faturalarım', href: '/invoices', icon: DocumentTextIcon },
     { name: 'Destek', href: '/support', icon: LifebuoyIcon },
];

function classNames(...classes: string[]) {
     return classes.filter(Boolean).join(' ');
}

export default function CustomerLayout() {
     const { isAuthenticated, user, logout } = useAuthStore();
     const location = useLocation();

     if (!isAuthenticated || user?.role !== 'CUSTOMER') {
          return <Navigate to="/login" state={{ from: location }} replace />;
     }

     return (
          <div className="min-h-screen bg-brand-light">
               {/* Sidebar */}
               <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col z-10 transition-transform duration-300">
                    <div className="flex items-center justify-center h-16 border-b border-gray-200">
                         <span className="text-xl font-bold text-brand-dark">OptiPlan360 B2B</span>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
                         {navigation.map((item) => {
                              const isActive = location.pathname === item.href;
                              return (
                                   <Link
                                        key={item.name}
                                        to={item.href}
                                        className={classNames(
                                             isActive ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                                             'group flex items-center px-3 py-2 text-sm font-medium rounded-md'
                                        )}
                                   >
                                        <item.icon
                                             className={classNames(
                                                  isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500',
                                                  'flex-shrink-0 -ml-1 mr-3 h-6 w-6'
                                             )}
                                             aria-hidden="true"
                                        />
                                        {item.name}
                                   </Link>
                              );
                         })}
                    </div>

                    <div className="p-4 border-t border-gray-200">
                         <div className="flex items-center w-full px-3 py-2 text-sm text-gray-700">
                              <span className="font-medium truncate">{user.display_name || user.username}</span>
                         </div>
                         <button
                              onClick={logout}
                              className="mt-2 group flex w-full items-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md"
                         >
                              <ArrowRightOnRectangleIcon className="flex-shrink-0 -ml-1 mr-3 h-6 w-6 text-red-500" aria-hidden="true" />
                              Çıkış Yap
                         </button>
                    </div>
               </div>

               {/* Main Content */}
               <div className="pl-64 flex flex-col min-h-screen">
                    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8 z-0 shadow-sm">
                         <h1 className="text-lg font-semibold text-gray-900">
                              {navigation.find(n => n.href === location.pathname)?.name || ''}
                         </h1>
                         <div className="flex items-center space-x-4">
                              <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                                   Canlı Bağlantı
                              </span>
                         </div>
                    </header>

                    <main className="flex-1 p-8">
                         <Outlet />
                    </main>
               </div>
          </div>
     );
}
