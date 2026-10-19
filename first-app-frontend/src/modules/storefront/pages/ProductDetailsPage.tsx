import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { useQuery as useTanstackQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Truck,
  RotateCcw,
  Check,
  Sparkles,
  ChevronLeft,
  AlertCircle,
  Plus,
  Minus,
  Star,
  CheckCircle2,
  PenLine,
  X,
  Loader2,
  User,
} from 'lucide-react';
import {
  GET_PRODUCT_DETAILS,
  type GetProductDetailsResponse,
} from '../../../api/storefront.graphql';
import { useCartStore } from '../../../store/useCartStore';
import { useAuthStore } from '../../../store/useAuthStore';
import reviewApi from '../../../api/reviewApi';
import { getImageUrl, handleImageError } from '../../../utils/imageHelper';
import type { Review } from '../../../types/review';

export const ProductDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCartStore();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [showToast, setShowToast] = useState<boolean>(false);

  // Review submission state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewFormError, setReviewFormError] = useState<string | null>(null);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string | null>(null);

  // Fetch GraphQL product details
  const { data, loading, error } = useQuery<
    GetProductDetailsResponse,
    { id: string }
  >(GET_PRODUCT_DETAILS, {
    variables: { id: id || '' },
    skip: !id,
    fetchPolicy: 'cache-and-network',
  });

  const product = data?.getProductDetails;
  const images = product?.images && product.images.length > 0 ? product.images : [];
  const currentImage = images[selectedImageIndex] || '';

  const stock = typeof product?.stock === 'number' ? product.stock : 0;
  const isAvailable = stock > 0;
  const maxAvailable = Math.max(1, stock);

  // Fetch verified reviews for this product
  const { data: reviewsData, isLoading: isLoadingReviews } = useTanstackQuery({
    queryKey: ['product-reviews', id],
    enabled: Boolean(id),
    queryFn: () => reviewApi.getProductReviews(id || '', { limit: 50 }),
  });

  // Fetch customer review eligibility (only if logged in)
  const { data: eligibilityData } = useTanstackQuery({
    queryKey: ['review-eligibility', id, user?.id],
    enabled: Boolean(id && user?.id),
    queryFn: () => reviewApi.checkEligibility(id || ''),
  });

  // Review submission mutation
  const submitReviewMutation = useMutation({
    mutationFn: (payload: { productId: string; rating: number; comment: string }) =>
      reviewApi.createReview(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-reviews', id] });
      queryClient.invalidateQueries({ queryKey: ['review-eligibility', id, user?.id] });
      setReviewModalOpen(false);
      setReviewComment('');
      setSelectedRating(5);
      setReviewSuccessMsg('شكراً لك! تم إضافة تقييمك المعتمد بنجاح.');
      setTimeout(() => setReviewSuccessMsg(null), 5000);
    },
    onError: (err: any) => {
      setReviewFormError(
        err.response?.data?.message || 'فشل في إضافة التقييم، يرجى المحاولة لاحقاً'
      );
    },
  });

  const reviews: Review[] = reviewsData?.reviews || [];
  const totalReviews = reviewsData?.total || reviews.length;
  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  // Star breakdown calculation
  const starCounts = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => Math.round(r.rating) === star).length;
    const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
    return { star, count, percentage };
  });

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (next > maxAvailable) return maxAvailable;
      return next;
    });
  };

  const handleAddToCart = () => {
    if (!product || !isAvailable) return;

    const firstVariant = product.variants?.[0];

    addToCart({
      productId: product.id,
      variantSku: firstVariant?.sku || `SKU-${product.id.slice(-6)}`,
      title: product.name || product.title || '',
      price: product.price,
      sellingEntityId: product.sellingEntityId || '',
      quantity,
      image: getImageUrl(currentImage || images[0]),
      vendorName: product.brandName,
    });

    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 2500);
  };

  const handleBuyNow = () => {
    handleAddToCart();
    navigate('/cart');
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setReviewFormError(null);

    if (selectedRating < 1 || selectedRating > 5) {
      setReviewFormError('يرجى اختيار عدد النجوم بين 1 و 5');
      return;
    }

    if (!reviewComment.trim()) {
      setReviewFormError('يرجى كتابة تعليقك حول تجربتك مع المنتج');
      return;
    }

    submitReviewMutation.mutate({
      productId: id,
      rating: selectedRating,
      comment: reviewComment.trim(),
    });
  };

  // Loading state
  if (loading && !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-pulse" dir="rtl">
        <div className="h-5 bg-slate-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-4">
            <div className="h-96 bg-slate-200 rounded-3xl"></div>
            <div className="flex gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 w-20 bg-slate-200 rounded-xl"></div>
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div className="h-8 bg-slate-200 rounded w-3/4"></div>
            <div className="h-12 bg-slate-200 rounded-2xl"></div>
            <div className="h-32 bg-slate-200 rounded-2xl"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error / Not found state
  if (error || !product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4" dir="rtl">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-800">تعذر العثور على المنتج</h2>
        <p className="text-xs text-slate-500">
          قد يكون المنتج غير متاح حالياً أو تم حذفه من قِبل المتجر.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-blue-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs hover:bg-blue-700 transition"
        >
          <span>العودة للمتجر</span>
          <ArrowRight className="w-4 h-4 rotate-180" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12" dir="rtl">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-5">
          <div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center text-white shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="font-bold">تمت إضافة المنتج بنجاح!</div>
            <div className="text-slate-300 text-[10px]">يمكنك الآن إتمام الطلب من السلة</div>
          </div>
          <Link
            to="/cart"
            className="mr-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-bold text-white transition"
          >
            عرض السلة
          </Link>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs font-medium text-slate-400">
        <Link to="/" className="hover:text-blue-600 transition">
          الرئيسية
        </Link>
        <span>/</span>
        {product.category && (
          <>
            <span className="text-slate-500">{product.category.name}</span>
            <span>/</span>
          </>
        )}
        <span className="text-slate-800 font-bold truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Main Product Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column (Image Gallery) - 7 cols */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main Display Image */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 flex items-center justify-center h-[380px] sm:h-[460px] relative overflow-hidden group shadow-sm">
            {images.length > 0 ? (
              <img
                src={getImageUrl(currentImage)}
                alt={product.name}
                onError={handleImageError}
                className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-300 gap-2">
                <ShoppingBag className="w-16 h-16 stroke-1" />
                <span className="text-xs">لا تتوفر صور لهذا المنتج</span>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`w-20 h-20 rounded-2xl p-2 border-2 transition-all bg-white shrink-0 overflow-hidden cursor-pointer ${
                    selectedImageIndex === idx
                      ? 'border-blue-600 shadow-md shadow-blue-500/10'
                      : 'border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <img
                    src={getImageUrl(img)}
                    alt={`${product.name} - ${idx + 1}`}
                    onError={handleImageError}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column (Product Information & Actions) - 5 cols */}
        <div className="lg:col-span-5 space-y-6">
          {/* Header Info */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {product.brandName && (
                <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>العلامة التجارية: {product.brandName}</span>
                </div>
              )}

              {/* Star Rating summary badge */}
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{averageRating ? `${averageRating} / 5` : 'جديد'}</span>
                {totalReviews > 0 && (
                  <span className="text-slate-400 text-[10px]">({totalReviews} تقييم)</span>
                )}
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
              {product.name}
            </h1>

            {/* Stock Badge */}
            <div className="flex items-center gap-3 pt-1">
              {isAvailable ? (
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-extrabold px-3 py-1.5 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  متوفر في المخزون (الكمية: {stock})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-extrabold px-3 py-1.5 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  نفذت الكمية
                </span>
              )}
            </div>
          </div>

          {/* Pricing Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-1">
            <div className="text-xs font-bold text-slate-400">السعر النهائي شاملاً الضريبة</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-slate-900">
                {product.price.toLocaleString()}
              </span>
              <span className="text-base font-extrabold text-slate-600">جنيه مصري (ج.م)</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              تفاصيل ومواصفات المنتج
            </h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed whitespace-pre-line bg-white p-4 rounded-2xl border border-slate-100">
              {product.description || 'منتج مضمون الجودة والمواصفات من المورد.'}
            </p>
          </div>

          {/* Variants Info (if available) */}
          {product.variants && product.variants.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700">الموديلات المتوفرة (SKU):</h4>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 font-mono text-xs rounded-lg border border-slate-200"
                  >
                    {v.sku}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Purchase Actions & Quantity Selector */}
          <div className="space-y-4 pt-2">
            {/* Quantity Selector */}
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-slate-700">الكمية المطلوبة:</span>
              <div className="inline-flex items-center border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
                <button
                  onClick={() => handleQuantityChange(-1)}
                  disabled={!isAvailable || quantity <= 1}
                  className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center text-sm font-black text-slate-900">
                  {quantity}
                </span>
                <button
                  onClick={() => handleQuantityChange(1)}
                  disabled={!isAvailable || quantity >= maxAvailable}
                  className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <span className="text-[11px] text-slate-400">
                (الحد الأقصى للشراء: {stock})
              </span>
            </div>

            {/* Buttons Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleAddToCart}
                disabled={!isAvailable}
                className="w-full py-3.5 px-6 rounded-2xl bg-slate-900 hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 transition-all cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>أضف إلى السلة</span>
              </button>

              <button
                onClick={handleBuyNow}
                disabled={!isAvailable}
                className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
              >
                <span>شراء الآن</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Guarantees & Features */}
          <div className="border-t border-slate-200/80 pt-6 grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-white rounded-xl border border-slate-100 flex flex-col items-center gap-1.5">
              <Truck className="w-5 h-5 text-blue-600" />
              <span className="text-[11px] font-bold text-slate-800">شحن سريع</span>
              <span className="text-[9px] text-slate-400">خلال 24-48 ساعة</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-100 flex flex-col items-center gap-1.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span className="text-[11px] font-bold text-slate-800">دفع محمي</span>
              <span className="text-[9px] text-slate-400">حماية Escrow 100%</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-100 flex flex-col items-center gap-1.5">
              <RotateCcw className="w-5 h-5 text-purple-600" />
              <span className="text-[11px] font-bold text-slate-800">إرجاع سهل</span>
              <span className="text-[9px] text-slate-400">خلال 14 يوماً</span>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* VERIFIED CUSTOMER REVIEWS SECTION */}
      {/* ======================================================== */}
      <div className="pt-10 border-t border-slate-200 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
              تقييمات ومراجعات المشترين المعتمدين
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              مراجعات حقيقية وموثقة حصرياً من عملاء اشتروا هذا المنتج واستلموه بنجاح
            </p>
          </div>

          {/* Action button if eligible */}
          {eligibilityData?.eligible && (
            <button
              onClick={() => {
                setReviewFormError(null);
                setReviewModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-blue-500/20 cursor-pointer self-start sm:self-auto"
            >
              <PenLine className="w-4 h-4" />
              <span>أضف تقييمك للمنتج</span>
            </button>
          )}
        </div>

        {/* Success Alert */}
        {reviewSuccessMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{reviewSuccessMsg}</span>
          </div>
        )}

        {/* Rating Breakdown & Stats */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 shadow-sm">
          {/* Average Score Box (4 cols) */}
          <div className="md:col-span-4 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-l border-slate-100 pb-6 md:pb-0 md:pl-6 space-y-2">
            <div className="text-5xl font-black text-slate-900">
              {averageRating || '5.0'}
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    star <= Math.round(Number(averageRating) || 5)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-200'
                  }`}
                />
              ))}
            </div>
            <div className="text-xs text-slate-500 font-medium">
              استناداً إلى {totalReviews} تقييم معتمد
            </div>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                100% مشتريات موثقة (Verified Purchases)
              </span>
            </div>
          </div>

          {/* Breakdown Bars (8 cols) */}
          <div className="md:col-span-8 space-y-2.5 flex flex-col justify-center">
            {starCounts.map(({ star, count, percentage }) => (
              <div key={star} className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1 w-14 shrink-0 font-bold text-slate-700">
                  <span>{star}</span>
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                </div>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <span className="w-10 text-left font-mono text-[11px] text-slate-400">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Reviews List */}
        {isLoadingReviews ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs font-bold">جارٍ تحميل التقييمات...</span>
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mx-auto">
              <Star className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">لا توجد تقييمات لهذا المنتج بعد</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              التقييمات متاحة للمشترين المعتمدين بعد استلام وتوصيل الطلب بنجاح.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((rev) => {
              const authorObj = typeof rev.customerId === 'object' ? rev.customerId : null;
              const authorName = authorObj
                ? `${authorObj.firstName || ''} ${authorObj.lastName || ''}`.trim() || 'مشتري معتمد'
                : 'مشتري معتمد';

              return (
                <div
                  key={rev._id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 font-black text-xs flex items-center justify-center border border-blue-200">
                        {authorName.charAt(0) || <User className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{authorName}</span>
                          {rev.isVerifiedPurchase && (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              مشتري موثق
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(rev.createdAt).toLocaleDateString('ar-EG')}
                        </span>
                      </div>
                    </div>

                    {/* Review Stars */}
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= rev.rating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {rev.title && (
                    <h4 className="text-xs font-black text-slate-800">{rev.title}</h4>
                  )}

                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                    {rev.comment}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* REVIEW SUBMISSION MODAL */}
      {reviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <PenLine className="w-5 h-5 text-blue-600" />
                تقييم المنتج (مشتري معتمد)
              </h3>
              <button
                onClick={() => setReviewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reviewFormError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{reviewFormError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitReview} className="space-y-4 text-xs">
              {/* Star Rating Selector */}
              <div className="space-y-2 text-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="font-bold text-slate-700 block">اختر تقييمك للمنتج: *</label>
                <div className="flex items-center justify-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = star <= (hoverRating || selectedRating);
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setSelectedRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 transition-transform hover:scale-125 cursor-pointer focus:outline-none"
                      >
                        <Star
                          className={`w-7 h-7 transition-colors ${
                            isFilled
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-300'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] font-bold text-slate-600">
                  {selectedRating === 5 && 'ممتاز - أنصح به بشدة'}
                  {selectedRating === 4 && 'جيد جداً'}
                  {selectedRating === 3 && 'متوسط - مطابق للوصف'}
                  {selectedRating === 2 && 'مقبول ولكن به بعض الملاحظات'}
                  {selectedRating === 1 && 'سيء - لم يعجبني'}
                </div>
              </div>

              {/* Review Comment */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">تفاصيل تجربتك مع المنتج: *</label>
                <textarea
                  required
                  rows={4}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="شارك رأيك الصادق حول الجودة، السرعة في التوصيل، والمواصفات لمساعدة المشترين الآخرين..."
                  className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>

              {/* Verified Purchase notice */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-2 text-emerald-800 text-[11px]">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>سيظهر تقييمك بعلامة "مشتري موثق" نظراً لاستلامك المنتج مسبقاً.</span>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitReviewMutation.isPending}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {submitReviewMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>نشر التقييم</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetailsPage;
