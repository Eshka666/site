import { component$, useSignal, useTask$, $ } from "@builder.io/qwik";
import { useLocation, useNavigate } from "@builder.io/qwik-city";
import { supabase } from "~/lib/supabase";

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  image_url: string;
  price: number;
  currency: string;
  category_id?: string;
}

// Функция для получения массива фото из строки - выносим наружу и оборачиваем в $()
const getImageArray = $((imageUrlString: string): string[] => {
  if (!imageUrlString) return [];
  
  return imageUrlString
    .split(',')
    .map((url: string) => url.trim())
    .filter((url: string) => url.length > 0);
});

export default component$(() => {
  const loc = useLocation();
  const nav = useNavigate();
  const product = useSignal<Product | null>(null);
  const loading = useSignal(true);
  const selectedImageIndex = useSignal(0);
  const deleting = useSignal(false);
  const showDeleteConfirm = useSignal(false);
  const showFullscreenImage = useSignal(false);
  const fullscreenImageIndex = useSignal(0);

  useTask$(async ({ track }) => {
    const slug = track(() => loc.params.slug);
    loading.value = true;
    product.value = null;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .single();

    if (!error && data) {
      product.value = data;
      selectedImageIndex.value = 0;
    }
    loading.value = false;
  });

  // Функция для открытия фото на весь экран
  const openFullscreenImage = $((index: number) => {
    fullscreenImageIndex.value = index;
    showFullscreenImage.value = true;
  });

  // Функция для закрытия фото
  const closeFullscreenImage = $(() => {
    showFullscreenImage.value = false;
  });

  // Функция для переключения фото в полноэкранном режиме
  const navigateFullscreenImage = $(async (direction: 'prev' | 'next') => {
    const images = product.value ? await getImageArray(product.value.image_url) : [];
    if (images.length === 0) return;

    if (direction === 'prev') {
      fullscreenImageIndex.value = fullscreenImageIndex.value > 0 
        ? fullscreenImageIndex.value - 1 
        : images.length - 1;
    } else {
      fullscreenImageIndex.value = fullscreenImageIndex.value < images.length - 1 
        ? fullscreenImageIndex.value + 1 
        : 0;
    }
  });

  // Функция удаления товара
  const deleteProduct = $(async () => {
    if (!product.value) return;
    
    deleting.value = true;
    
    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.value.id);
      
      if (error) {
        throw new Error("Ошибка при удалении товара: " + error.message);
      }
      
      nav("/");
      
    } catch (err) {
      alert((err as Error).message);
    } finally {
      deleting.value = false;
      showDeleteConfirm.value = false;
    }
  });

  if (loading.value) {
    return (
      <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
          <p class="text-gray-600">Загрузка товара...</p>
        </div>
      </div>
    );
  }

  if (!product.value) {
    return (
      <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div class="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div class="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 class="text-2xl font-bold text-gray-800 mb-2">Товар не найден</h2>
          <p class="text-gray-600 mb-6">Такого товара не существует или он был удален.</p>
          <button
            onClick$={() => nav("/")}
            class="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200"
          >
            Вернуться на главную
          </button>
        </div>
      </div>
    );
  }

  // Используем асинхронный вызов getImageArray внутри useTask$ или создаем отдельный сигнал
  // Для простоты можно оставить как есть, но если нужна реактивность:
  const imageUrls = product.value.image_url
    .split(',')
    .map((url: string) => url.trim())
    .filter((url: string) => url.length > 0);
  
  const mainImage = imageUrls[selectedImageIndex.value] || '';

  return (
    <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Модальное окно полноэкранного просмотра фото */}
      {showFullscreenImage.value && (
        <div 
          class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick$={closeFullscreenImage}
        >
          {/* Кнопка закрытия */}
          <button
            onClick$={closeFullscreenImage}
            class="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors duration-200 z-10"
            title="Закрыть (ESC)"
          >
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Кнопка предыдущего фото */}
          {imageUrls.length > 1 && (
            <button
              onClick$={(e) => {
                e.stopPropagation();
                navigateFullscreenImage('prev');
              }}
              class="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 transition-colors duration-200 z-10"
              title="Предыдущее фото (←)"
            >
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Кнопка следующего фото */}
          {imageUrls.length > 1 && (
            <button
              onClick$={(e) => {
                e.stopPropagation();
                navigateFullscreenImage('next');
              }}
              class="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 transition-colors duration-200 z-10"
              title="Следующее фото (→)"
            >
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Счетчик фото */}
          <div class="absolute top-4 left-4 text-white z-10">
            <span class="font-medium">
              {fullscreenImageIndex.value + 1} / {imageUrls.length}
            </span>
          </div>

          {/* Контейнер для фото */}
          <div class="relative max-w-4xl w-full max-h-[90vh]" onClick$={(e) => e.stopPropagation()}>
            <img
              src={imageUrls[fullscreenImageIndex.value]}
              alt={`${product.value.name} - фото ${fullscreenImageIndex.value + 1}`}
              class="w-full h-full object-contain max-h-[90vh] rounded-lg"
               height={100}
                    width={100}
            />
          </div>

          {/* Навигация снизу (миниатюры) */}
          {imageUrls.length > 1 && (
            <div class="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10" onClick$={(e) => e.stopPropagation()}>
              {imageUrls.map((url, index) => (
                <button
                  key={index}
                  onClick$={() => fullscreenImageIndex.value = index}
                  class={`w-16 h-16 rounded-lg overflow-hidden transition-all duration-200 ${
                    fullscreenImageIndex.value === index 
                      ? 'ring-2 ring-white scale-110' 
                      : 'opacity-60 hover:opacity-100 hover:scale-105'
                  }`}
                >
                  <img
                    src={url}
                    alt={`Миниатюра ${index + 1}`}
                    class="w-full h-full object-cover"
                    height={100}
                    width={100}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Модальное окно подтверждения удаления */}
      {showDeleteConfirm.value && (
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div class="text-center">
              <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg class="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.406 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 class="text-lg font-bold text-gray-900 mb-2">
                Удалить товар?
              </h3>
              <p class="text-gray-600 mb-6">
                Вы уверены, что хотите удалить "{product.value.name}"? Это действие нельзя отменить.
              </p>
              <div class="flex gap-3">
                <button
                  onClick$={() => showDeleteConfirm.value = false}
                  class="flex-1 py-3 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors duration-200"
                  disabled={deleting.value}
                >
                  Отмена
                </button>
                <button
                  onClick$={deleteProduct}
                  disabled={deleting.value}
                  class="flex-1 py-3 px-4 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  {deleting.value ? (
                    <>
                      <div class="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                      Удаление...
                    </>
                  ) : (
                    <>
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Удалить
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div class="max-w-6xl mx-auto p-4 md:p-6">
        <div class="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Хедер с кнопками */}
          <div class="p-6 border-b border-gray-200">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <button
                onClick$={() => history.back()}
                class="flex items-center text-gray-600 hover:text-gray-800 transition-colors duration-200"
              >
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Назад к списку товаров
              </button>
              
              <div class="flex gap-3">
                {/* Кнопка редактирования - исправленная версия */}
                <button
                  onClick$={() => {
                    window.location.href = `/product/${product.value!.slug}/edit/`;
                  }}
                  class="px-4 py-2 rounded-lg border border-blue-600 text-blue-600 font-medium hover:bg-blue-50 transition-colors duration-200 flex items-center gap-2"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Редактировать
                </button>
                
                <button
                  onClick$={() => showDeleteConfirm.value = true}
                  class="px-4 py-2 rounded-lg border border-red-600 text-red-600 font-medium hover:bg-red-50 transition-colors duration-200 flex items-center gap-2"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Удалить
                </button>
              </div>
            </div>
          </div>

          <div class="flex flex-col lg:flex-row">
            {/* Левая часть: Фотографии */}
            {/* Левая часть: Фотографии */}
<div class="lg:w-1/2 p-6 lg:p-8">
  {/* Главное фото */}
  <div class="mb-8">
    {mainImage ? (
      <div 
        class="relative aspect-square overflow-hidden rounded-2xl border-2 border-gray-200 bg-gray-100 cursor-pointer hover:border-blue-400 transition-colors duration-200"
        onClick$={() => openFullscreenImage(selectedImageIndex.value)}
      >
        <img
          src={mainImage}
          alt={`${product.value.name} - фото ${selectedImageIndex.value + 1}`}
          class="w-full h-full object-contain p-4"
          height={100}
          width={100}
        />
        <div class="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
          <div class="bg-black/50 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
            </svg>
            На весь экран
          </div>
        </div>
      </div>
    ) : (
      <div class="aspect-square rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        <div class="text-center">
          <div class="text-gray-400 text-6xl mb-2">📷</div>
          <p class="text-gray-500">Нет фотографий</p>
        </div>
      </div>
    )}
  </div>

  {/* Миниатюры */}
  {imageUrls.length > 0 && (
    <div class="mt-8">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-medium text-gray-700">
          Все фотографии ({imageUrls.length})
        </h3>
        <span class="text-sm text-gray-500">
          Нажмите для выбора или полноэкранного просмотра
        </span>
      </div>
      <div class="flex flex-wrap gap-3">
        {imageUrls.map((url: string, index: number) => (
          <div 
            key={index}
            class="relative"
          >
            <div
              class={`relative w-20 h-20 rounded-xl overflow-hidden transition-all duration-200 cursor-pointer ${
                selectedImageIndex.value === index 
                  ? 'ring-2 ring-blue-500 ring-offset-2 scale-105' 
                  : 'hover:scale-102 opacity-90 hover:opacity-100'
              }`}
            >
              {/* Основной клик - меняет главное фото */}
              <button
                onClick$={() => selectedImageIndex.value = index}
                class="absolute inset-0 w-full h-full"
                title={`Выбрать фото ${index + 1} как главное`}
              >
                <img
                  src={url}
                  alt={`Миниатюра ${index + 1}`}
                  class="w-full h-full object-cover"
                  height={100}
                  width={100}
                />
              </button>
              
              {/* Бейдж с номером фото */}
              {selectedImageIndex.value === index ? (
                <div class="absolute bottom-1 right-1 bg-blue-500 text-white text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
                  ✓
                </div>
              ) : (
                <div class="absolute bottom-1 right-1 bg-black/70 text-white text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
                  {index + 1}
                </div>
              )}
              
              {/* Кнопка для открытия этой миниатюры на весь экран */}
              <button
                onClick$={(e) => {
                  e.stopPropagation();
                  openFullscreenImage(index);
                }}
                class="absolute top-1 left-1 bg-black/70 hover:bg-black/90 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors duration-200"
                title="Открыть на весь экран"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
              </button>
            </div>
            
            {/* Подпись под миниатюрой */}
            <div class="text-xs text-gray-500 mt-1 text-center">
              {index === 0 ? "Главное" : `Фото ${index + 1}`}
            </div>
          </div>
        ))}
      </div>
      
      {/* Подсказка */}
      <div class="mt-4 text-sm text-gray-500">
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1">
            <div class="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>— выбрано как главное</span>
          </div>
          <div class="flex items-center gap-1">
            <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
            </svg>
            <span>— открыть на весь экран</span>
          </div>
        </div>
      </div>
    </div>
  )}
</div>

            {/* Правая часть: Информация */}
            <div class="lg:w-1/2 p-6 lg:p-8 lg:border-l border-gray-200">
              <div class="mb-8">
                <h1 class="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                  {product.value.name}
                </h1>
                <div class="flex items-center gap-2">
                  <span class="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                    {product.value.slug}
                  </span>
                  <span class="text-gray-500 text-sm">
                    ID: {product.value.id.slice(0, 8)}...
                  </span>
                </div>
              </div>

              {/* Цена */}
              <div class="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl">
                <div class="flex items-baseline gap-2">
                  <span class="text-4xl font-bold text-gray-900">
                    {product.value.price.toFixed(2)}
                  </span>
                  <span class="text-xl font-semibold text-gray-700">
                    {product.value.currency}
                  </span>
                </div>
                {product.value.currency !== 'BYN' && (
                  <p class="text-gray-600 mt-2">
                    ≈ {(product.value.price * 3.2).toFixed(2)} BYN
                  </p>
                )}
              </div>

              {/* Описание */}
              <div class="mb-8">
                <h2 class="text-xl font-semibold text-gray-800 mb-3">
                  Описание товара
                </h2>
                <div class="bg-gray-50 p-5 rounded-xl">
                  {product.value.description ? (
                    <p class="text-gray-700 leading-relaxed">
                      {product.value.description}
                    </p>
                  ) : (
                    <p class="text-gray-500 italic">Описание отсутствует</p>
                  )}
                </div>
              </div>

              {/* Действия */}
              <div class="mb-8">
                <h2 class="text-xl font-semibold text-gray-800 mb-4">
                  Действия с товаром
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick$={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: product.value!.name,
                          text: product.value!.description || '',
                          url: window.location.href,
                        });
                      }
                    }}
                    class="p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 flex items-center gap-3"
                  >
                    <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </div>
                    <div class="text-left">
                      <div class="font-medium text-gray-800">Поделиться</div>
                      <div class="text-sm text-gray-500">Отправить ссылку</div>
                    </div>
                  </button>
                  
                  <button
                    onClick$={() => window.print()}
                    class="p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 flex items-center gap-3"
                  >
                    <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                    </div>
                    <div class="text-left">
                      <div class="font-medium text-gray-800">Печать</div>
                      <div class="text-sm text-gray-500">Версия для печати</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* QR-код */}
              <div class="mb-8 pt-8 border-t border-gray-200">
                <h2 class="text-xl font-semibold text-gray-800 mb-4">
                  QR-код товара
                </h2>
                <div class="flex flex-col items-center">
                  <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-4">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.href)}`}
                      alt="QR Code"
                      class="w-48 h-48"
                      height={100}
                      width={100}
                    />
                  </div>
                  <p class="text-center text-gray-600">
                    Отсканируйте для быстрого доступа
                  </p>
                  <p class="text-xs text-gray-500 text-center mt-2 break-all">
                    {window.location.href}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Футер с предупреждением */}
          <div class="p-6 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
            <div class="flex items-start gap-3">
              <div class="flex-shrink-0 mt-1">
                <svg class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 class="font-semibold text-gray-800 mb-1">
                  Информация о товаре
                </h3>
                <p class="text-sm text-gray-600">
                  По вопросам о товаре обращайтесь к администратору. Товар добавлен в каталог и доступен для просмотра.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});