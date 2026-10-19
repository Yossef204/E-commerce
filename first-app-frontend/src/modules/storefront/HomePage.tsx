import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  ShoppingBag,
  ShieldCheck,
  Zap,
  Truck,
  Tag,
  Search,
  ArrowUpDown,
  ChevronRight,
  ChevronLeft,
  PackageOpen,
  Check,
  Store,
  Layers,
  Sparkles,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  GET_STOREFRONT_DATA,
  type GetStorefrontDataResponse,
  type CatalogFilterInput,
  type StorefrontProduct,
  type StorefrontCategory,
} from '../../api/storefront.graphql';
import { useCartStore } from '../../store/useCartStore';
import { getImageUrl, handleImageError } from '../../utils/imageHelper';

export const HomePage: React.FC = () => {
  const { addToCart } = useCartStore();

  // State
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('NEWEST');
  const [page, setPage] = useState<number>(1);
  const [cartSuccessId, setCartSuccessId] = useState<string | null>(null);

  const productsSectionRef = useRef<HTMLDivElement>(null);

  // Debounce search query for instant filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Map sort options to GraphQL filter
  const getSortParams = (sort: string) => {
    switch (sort) {
      case 'PRICE_ASC':
        return { sortBy: 'PRICE', sortOrder: 'ASC' };
      case 'PRICE_DESC':
        return { sortBy: 'PRICE', sortOrder: 'DESC' };
      case 'NEWEST':
      default:
        return { sortBy: 'CREATED_AT', sortOrder: 'DESC' };
    }
  };

  const sortParams = getSortParams(sortBy);

  // GraphQL Query
  const { data, loading, error, refetch } = useQuery<
    GetStorefrontDataResponse,
    { filter: CatalogFilterInput }
  >(GET_STOREFRONT_DATA, {
    variables: {
      filter: {
        categoryId: selectedCategoryId || undefined,
        search: debouncedSearch.trim() || undefined,
        sortBy: sortParams.sortBy,
        sortOrder: sortParams.sortOrder,
        page,
        limit: 12,
      },
    },
    fetchPolicy: 'cache-and-network',
  });

  const categories = data?.getStorefrontCategories || [];
  const productData = data?.getStorefrontProducts;
  const products = productData?.items || [];
  const totalProducts = productData?.total || 0;
  const totalPages = productData?.totalPages || 1;

  const handleCategorySelect = (catId: string) => {
    setSelectedCategoryId(catId);
    setPage(1);
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      productsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleAddToCart = (product: StorefrontProduct) => {
    addToCart({
      productId: product.id,
      variantSku: product.variants?.[0]?.sku || `SKU-${product.id.slice(-6)}`,
      title: product.name,
      price: product.price,
      sellingEntityId: product.sellingEntityId || 'platform',
      quantity: 1,
      image: getImageUrl(product.images),
      vendorName: product.brandName || 'المتجر الرسمي',
    });

    setCartSuccessId(product.id);
    setTimeout(() => {
      setCartSuccessId(null);
    }, 2000);
  };

  return (
    <div className="space-y-12 pb-16" dir="rtl">
      {/* 1. Hero Banner */}
      <section className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white rounded-3xl p-8 md:p-14 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="relative z-10 max-w-2xl space-y-6">
          <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md text-blue-100 text-xs font-semibold px-4 py-1.5 rounded-full border border-white/20">
            <Zap className="w-3.5 h-3.5 text-yellow-300" />
            عروض حصرية وضمان جودة 100%
          </span>
          <h1 className="text-3xl md:text-5xl font-black leading-tight tracking-tight">
            أفضل المنتجات العالمية بأفضل الأسعار والتوصيل السريع
          </h1>
          <p className="text-blue-100 text-base md:text-lg leading-relaxed">
            تسوق بكل ثقة من نخبة المتاجر والعلامات التجارية المعتمدة، مع حماية مدفوعاتك بنظام الضمان المالي Escrow.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <button
              onClick={() => productsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-white text-blue-700 hover:bg-blue-50 font-bold px-7 py-3.5 rounded-xl shadow-lg transition-all text-sm cursor-pointer"
            >
              استكشف الكتالوج الآن
            </button>
            <Link
              to="/register"
              className="bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3.5 rounded-xl border border-white/20 backdrop-blur-md transition-all text-sm flex items-center gap-2"
            >
              <Store className="w-4 h-4" />
              <span>انضم كتاجر وافتح متجرك</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Value Propositions */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4">
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-xl">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">شحن سريع ومباشر</h3>
            <p className="text-slate-500 text-xs mt-1">توصيل آمن لجميع المحافظات خلال 24-48 ساعة</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">دفع محمي بنظام Escrow</h3>
            <p className="text-slate-500 text-xs mt-1">أموالك محفوظة بأمان حتى استلام وفحص طلبك</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4">
          <div className="p-3.5 bg-purple-50 text-purple-600 rounded-xl">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">منتجات معتمدة 100%</h3>
            <p className="text-slate-500 text-xs mt-1">تخضع جميع المنتجات لمراجعة الجودة ومصادقة الإدارة</p>
          </div>
        </div>
      </section>

      {/* 3. Main Catalog Section */}
      <section ref={productsSectionRef} className="space-y-6 pt-4">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-blue-600" />
              كتالوج المنتجات المعروضة
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              تصفح أحدث المنتجات المتوفرة والمفحوصة من كبار الموردين والتجار
            </p>
          </div>

          <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
            إجمالي المعروض: <span className="text-blue-600 font-extrabold">{totalProducts}</span> منتج
          </div>
        </div>

        {/* Categories Bar (Filter by Category) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => handleCategorySelect('')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              selectedCategoryId === ''
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>كافة الأقسام (الكل)</span>
          </button>

          {categories.map((cat: StorefrontCategory) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                selectedCategoryId === cat.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Search and Sort Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Instant Search Bar with Debounce */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم، الموديل، أو الكود..."
              className="w-full pr-10 pl-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Dropdown & Quick Indicator */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs font-bold text-slate-600 shrink-0">الترتيب:</span>
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="NEWEST">الأحدث وصولاً (Newest)</option>
                <option value="PRICE_ASC">السعر: من الأقل للأعلى</option>
                <option value="PRICE_DESC">السعر: من الأعلى للأقل</option>
              </select>
            </div>
          </div>
        </div>

        {/* 4. Products Grid Area */}
        {loading && !data ? (
          /* Loading Skeletons */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div
                key={n}
                className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 animate-pulse"
              >
                <div className="h-48 bg-slate-100 rounded-xl"></div>
                <div className="h-4 bg-slate-100 rounded w-1/3"></div>
                <div className="h-5 bg-slate-100 rounded w-3/4"></div>
                <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                <div className="flex justify-between items-center pt-2">
                  <div className="h-6 bg-slate-100 rounded w-1/4"></div>
                  <div className="h-8 bg-slate-100 rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          /* Error State */
          <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-3">
            <p className="text-rose-600 text-sm font-bold">تعذر تحميل بيانات المنتجات من الخادم.</p>
            <p className="text-slate-400 text-xs">{error.message}</p>
            <button
              onClick={() => refetch()}
              className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : products.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-2xl p-16 border border-slate-200 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto border border-slate-100">
              <PackageOpen className="w-8 h-8 opacity-70" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-800 text-base">لا توجد منتجات مطابقة للبحث</h3>
              <p className="text-slate-400 text-xs">
                لم نتمكن من العثور على أي منتج يطابق معايير البحث أو القسم المختار.
              </p>
            </div>
            {(selectedCategoryId || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedCategoryId('');
                  setSearchQuery('');
                  setPage(1);
                }}
                className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-blue-600 transition-colors shadow cursor-pointer"
              >
                مسح التصفية وعرض كافة المنتجات
              </button>
            )}
          </div>
        ) : (
          /* Real Products Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product: StorefrontProduct) => {
              const isAvailable = product.stock > 0;
              const isRecentlyAdded = cartSuccessId === product.id;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden hover:shadow-xl hover:border-blue-200 transition-all duration-300 flex flex-col justify-between group"
                >
                  <Link
                    to={`/product/${product.id}`}
                    className="block flex-1 flex flex-col cursor-pointer"
                  >
                    {/* Image Container */}
                    <div className="h-52 bg-slate-50 relative overflow-hidden flex items-center justify-center border-b border-slate-100">
                      <img
                        src={getImageUrl(product.images)}
                        alt={product.name}
                        onError={handleImageError}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />

                      {/* Stock Status Badge */}
                      <div className="absolute top-2.5 left-2.5">
                        {isAvailable ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-600/95 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm">
                            متوفر في المخزون (الكمية: {product.stock})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-rose-600/95 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm">
                            نفذت الكمية
                          </span>
                        )}
                      </div>

                      {/* Category Tag */}
                      {product.category?.name && (
                        <div className="absolute top-2.5 right-2.5">
                          <span className="inline-flex items-center gap-1 bg-slate-900/80 backdrop-blur-md text-slate-100 text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-sm">
                            {product.category.name}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Body Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-1.5">
                        {product.brandName && (
                          <span className="text-[11px] font-bold text-blue-600 block truncate">
                            {product.brandName}
                          </span>
                        )}

                        <h3
                          className="font-extrabold text-slate-900 text-sm line-clamp-1 group-hover:text-blue-600 transition-colors"
                          title={product.name}
                        >
                          {product.name}
                        </h3>

                        <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed">
                          {product.description || 'منتج مضمون الجودة والمواصفات.'}
                        </p>
                      </div>
                    </div>
                  </Link>

                  {/* Price and Cart Action */}
                  <div className="px-5 pb-5 pt-0">
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">السعر</span>
                        <div className="flex items-baseline gap-1">
                          <span className="font-black text-slate-900 text-lg leading-none">
                            {product.price.toLocaleString()}
                          </span>
                          <span className="text-xs font-bold text-slate-500">ج.م</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAddToCart(product);
                        }}
                        disabled={!isAvailable}
                        className={`px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                          isRecentlyAdded
                            ? 'bg-emerald-600 text-white'
                            : isAvailable
                            ? 'bg-slate-900 hover:bg-blue-600 text-white shadow-slate-900/10'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {isRecentlyAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>تمت الإضافة</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>أضف للسلة</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 5. Pagination Controls */}
        {totalPages > 1 && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
            <div className="text-xs text-slate-500 font-semibold">
              عرض الصفحة <span className="text-slate-900 font-bold">{page}</span> من إجمالي{' '}
              <span className="text-slate-900 font-bold">{totalPages}</span> صفحات
            </div>

            <div className="flex items-center gap-1.5">
              {/* Previous Button */}
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
                <span>السابق</span>
              </button>

              {/* Page Number Chips */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const hasGap = prev && p - prev > 1;

                  return (
                    <React.Fragment key={p}>
                      {hasGap && <span className="text-slate-400 text-xs px-1">...</span>}
                      <button
                        onClick={() => handlePageChange(p)}
                        className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          page === p
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}

              {/* Next Button */}
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <span>التالي</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default HomePage;
