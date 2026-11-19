import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { Menu } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import {
  ActiveTab,
  CompanySettings,
  Customer,
  Product,
  ProductCategoryDoc,
  Quotation,
  StaffInvite,
  UserProfile,
} from './types';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  defaultCompanySettings,
  deleteCustomerWithDependencyCheck,
  deleteProductSafe,
  deleteQuotationCascade,
  saveCategoryDoc,
  saveCompanySettingsDoc,
  saveCustomerDoc,
  saveProductDoc,
  saveQuotationWithItems,
  seedWorkspaceDefaults,
  syncUserProfile,
  updateProductPriceQuick,
  updateQuotationStatus,
} from './services/firestoreService';
import { getShamsiDate } from './utils/formatters';
import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { InvoicesView } from './components/InvoicesView';
import { CustomersView } from './components/CustomersView';
import { ProductsView } from './components/ProductsView';
import { ReportsView } from './components/ReportsView';
import { UsersView } from './components/UsersView';
import { SettingsView } from './components/SettingsView';
import { InvoiceEditorModal } from './components/InvoiceEditorModal';
import { InvoicePrintModal } from './components/InvoicePrintModal';

export function App() {
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [inactiveNotice, setInactiveNotice] = useState('');

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [companySettings, setCompanySettings] = useState<CompanySettings>(
    defaultCompanySettings
  );
  const [categories, setCategories] = useState<ProductCategoryDoc[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<StaffInvite[]>([]);

  // Modals
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<Quotation | null>(null);
  const [previewQuotation, setPreviewQuotation] = useState<Quotation | null>(null);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setCurrentUser(null);
        setAuthReady(true);
        return;
      }

      try {
        const profile = await syncUserProfile(fbUser);
        if (!profile.isActive) {
          setCurrentUser(null);
          setInactiveNotice(
            'حساب کاربری شما توسط مدیر سیستم غیرفعال شده است. لطفاً با مدیر فروش تماس بگیرید.'
          );
          setAuthReady(true);
          return;
        }
        setInactiveNotice('');
        setCurrentUser(profile);
        await seedWorkspaceDefaults(profile);
      } catch (err) {
        console.error('Auth sync error:', err);
        setCurrentUser(null);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  // Firestore real-time listeners (only active when authenticated & active)
  useEffect(() => {
    if (!currentUser) return;

    const isBootstrapAdmin = currentUser.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
    const unsubs: (() => void)[] = [];

    // 1. Company Settings
    unsubs.push(
      onSnapshot(
        doc(db, 'company_settings', 'main'),
        (snap) => {
          if (snap.exists()) {
            setCompanySettings({
              ...defaultCompanySettings,
              ...(snap.data() as CompanySettings),
            });
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'company_settings/main')
      )
    );

    // 2. Product Categories
    const catQuery = isBootstrapAdmin
      ? query(collection(db, 'product_categories'), orderBy('sortOrder', 'asc'))
      : query(
          collection(db, 'product_categories'),
          where('isActive', '==', true)
        );
    unsubs.push(
      onSnapshot(
        catQuery,
        (snap) => {
          const rows = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ProductCategoryDoc, 'id'>),
          }));
          rows.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
          setCategories(rows);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'product_categories')
      )
    );

    // 3. Products
    const prodQuery = isBootstrapAdmin
      ? query(collection(db, 'products'))
      : query(collection(db, 'products'), where('isActive', '==', true));
    unsubs.push(
      onSnapshot(
        prodQuery,
        (snap) => {
          setProducts(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'products')
      )
    );

    // 4. Customers
    const custQuery = isBootstrapAdmin
      ? query(collection(db, 'customers'))
      : query(collection(db, 'customers'), where('createdByUid', '==', currentUser.uid));
    unsubs.push(
      onSnapshot(
        custQuery,
        (snap) => {
          setCustomers(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Customer, 'id'>) }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'customers')
      )
    );

    // 5. Quotations
    const quotQuery = isBootstrapAdmin
      ? query(collection(db, 'quotations'), orderBy('createdAt', 'desc'))
      : query(
          collection(db, 'quotations'),
          where('createdByUid', '==', currentUser.uid)
        );
    unsubs.push(
      onSnapshot(
        quotQuery,
        (snap) => {
          const rows = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Quotation, 'id'>),
          }));
          if (!isBootstrapAdmin) {
            rows.sort((a, b) => b.quotationNumber.localeCompare(a.quotationNumber));
          }
          setQuotations(rows);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'quotations')
      )
    );

    // 6. Admin-only Users & Staff Invites
    if (isBootstrapAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) => {
            setUsers(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserProfile, 'id'>) }))
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'users')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'staff_invites'),
          (snap) => {
            setInvites(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StaffInvite, 'id'>) }))
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'staff_invites')
        )
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [currentUser]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F1F3F5] flex items-center justify-center p-6">
        <div className="text-sm font-medium text-[#172535]">در حال بارگذاری سامانه Aghrin PishFactor...</div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginView
        inactiveMessage={inactiveNotice}
        onSignOutInactive={() => setInactiveNotice('')}
      />
    );
  }

  const isAdmin = currentUser.role === 'admin';

  const tabTitles: Record<ActiveTab, string> = {
    dashboard: 'داشبورد',
    invoices: 'آرشیو پیش‌فاکتورها',
    customers: 'مدیریت مشتریان',
    products: 'مدیریت کالا و قیمت',
    reports: 'گزارش‌های فروش',
    users: 'کاربران و لاگ فعالیت',
    settings: 'تنظیمات شرکت',
  };

  const handleOpenCreateInvoice = () => {
    setEditingQuotation(null);
    setDuplicateSource(null);
    setIsEditorOpen(true);
  };

  const handleOpenEditInvoice = (q: Quotation) => {
    setPreviewQuotation(null);
    setDuplicateSource(null);
    setEditingQuotation(q);
    setIsEditorOpen(true);
  };

  const handleOpenDuplicateInvoice = (q: Quotation) => {
    setEditingQuotation(null);
    setDuplicateSource(q);
    setIsEditorOpen(true);
  };

  return (
    <div className="min-h-screen flex bg-[#F1F3F5] text-[#172535]">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onCreateInvoice={handleOpenCreateInvoice}
        onSignOut={() => void signOut(auth)}
        currentUser={currentUser}
        companyName={companySettings.companyName}
        logoDataUrl={companySettings.logoDataUrl}
        invoiceCount={quotations.length}
        productCount={products.length}
        customerCount={customers.length}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 no-print">
        <header className="no-print h-14 bg-white border-b border-[#D7DEE5] px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-[#F1F3F5]"
              aria-label="باز کردن منو"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-400">آهن آگرین</span>
              <span className="text-slate-300">/</span>
              <span className="font-bold text-[#172535]">{tabTitles[activeTab]}</span>
            </div>
          </div>

          <div className="text-xs text-slate-500 tabular-nums whitespace-nowrap shrink-0">
            تاریخ امروز: {getShamsiDate()}
          </div>
        </header>

        <main className="no-print flex-1 p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              quotations={quotations}
              customers={customers}
              currency={companySettings.currency}
              onNavigate={setActiveTab}
              onCreateInvoice={handleOpenCreateInvoice}
              onPreviewInvoice={(q) => setPreviewQuotation(q)}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesView
              quotations={quotations}
              currentUser={currentUser}
              onCreateInvoice={handleOpenCreateInvoice}
              onEditInvoice={handleOpenEditInvoice}
              onPreviewInvoice={(q) => setPreviewQuotation(q)}
              onDuplicateInvoice={handleOpenDuplicateInvoice}
              onUpdateStatus={(q, st) => updateQuotationStatus(q, st, currentUser)}
              onDeleteInvoice={(q) => deleteQuotationCascade(q, currentUser)}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersView
              customers={customers}
              quotations={quotations}
              currency={companySettings.currency}
              currentUser={currentUser}
              onSaveCustomer={(c) => saveCustomerDoc(c, currentUser)}
              onDeleteCustomer={(c) =>
                deleteCustomerWithDependencyCheck(c, quotations, currentUser)
              }
            />
          )}

          {activeTab === 'products' && (
            <ProductsView
              products={products}
              categories={categories}
              currency={companySettings.currency}
              currentUser={currentUser}
              onSaveProduct={(p) => saveProductDoc(p, currentUser)}
              onQuickPriceUpdate={(p, price) =>
                updateProductPriceQuick(p, price, currentUser)
              }
              onDeleteProduct={(p) => deleteProductSafe(p, currentUser)}
              onSaveCategory={(cat) => saveCategoryDoc(cat, currentUser)}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView quotations={quotations} currency={companySettings.currency} />
          )}

          {activeTab === 'users' && isAdmin && (
            <UsersView users={users} invites={invites} currentUser={currentUser} />
          )}

          {activeTab === 'settings' && isAdmin && (
            <SettingsView
              settings={companySettings}
              onSaveSettings={(s) => saveCompanySettingsDoc(s, currentUser)}
              backupPayload={{
                settings: companySettings,
                categories,
                products,
                customers,
                quotations,
              }}
            />
          )}
        </main>
      </div>

      {isEditorOpen && (
        <InvoiceEditorModal
          existingQuotation={editingQuotation}
          duplicateSource={duplicateSource}
          customers={customers}
          products={products}
          companySettings={companySettings}
          onSubmit={async (payload) => {
            await saveQuotationWithItems({
              ...payload,
              actor: currentUser,
            });
            setIsEditorOpen(false);
            setEditingQuotation(null);
            setDuplicateSource(null);
          }}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingQuotation(null);
            setDuplicateSource(null);
          }}
        />
      )}

      {previewQuotation && (
        <InvoicePrintModal
          quotation={previewQuotation}
          company={companySettings}
          canEdit={
            isAdmin ||
            (previewQuotation.createdByUid === currentUser.uid &&
              previewQuotation.status !== 'تاییدشده' &&
              previewQuotation.status !== 'لغوشده')
          }
          onEdit={() => handleOpenEditInvoice(previewQuotation)}
          onClose={() => setPreviewQuotation(null)}
        />
      )}
    </div>
  );
}

export default App;
