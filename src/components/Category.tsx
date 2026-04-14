import {
  component$,
  useSignal,
  useTask$,
  $,
  useContext,
} from "@builder.io/qwik";
import { useNavigate, useLocation } from "@builder.io/qwik-city";
import { supabase } from "~/lib/supabase";
import { ProductUpdateContext } from "~/context/product-context";

type Category = {
  id: string;
  name: string;
  slug: string;
  product_count?: number;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  category_id: string;
};

type DeleteModalData = {
  type: 'category' | 'product';
  id: string;
  name: string;
  productCount?: number;
  productNames?: string[];
};

export default component$(() => {
  const categories = useSignal<Category[]>([]);
  const selectedCategory = useSignal<string | null>(null);
  const products = useSignal<{ [key: string]: Product[] }>({});
  const isCategoryOpen = useSignal<{ [key: string]: boolean }>({});
  const activeProductSlug = useSignal<string | null>(null);
  const deleteModalData = useSignal<DeleteModalData | null>(null);
  const deleting = useSignal(false);
  
  const nav = useNavigate();
  const location = useLocation();

  const productUpdate = useContext(ProductUpdateContext);

  // Загружаем категории при монтировании
  useTask$(async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug")
      .order("name");
    if (error || !data) return;
    categories.value = data as Category[];
  });

  // Следим за изменением URL → если открыт продукт, раскрываем его категорию
  useTask$(async ({ track }) => {
    track(() => location.url.pathname);

    const path = location.url.pathname;
    if (path.startsWith("/product/") && !path.endsWith("/new")) {
      const slug = path.split("/product/")[1].replace("/", "");
      if (!slug) return;

      activeProductSlug.value = slug;

      // Запрашиваем товар по slug
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug, category_id")
        .eq("slug", slug)
        .single();

      if (error || !data) return;

      const categoryId = data.category_id;
      selectedCategory.value = categoryId;

      // раскрываем категорию
      isCategoryOpen.value = { ...isCategoryOpen.value, [categoryId]: true };

      // грузим товары этой категории
      const { data: prodData } = await supabase
        .from("products")
        .select("id, name, slug, category_id")
        .eq("category_id", categoryId)
        .order("name");

      if (prodData) {
        products.value = {
          ...products.value,
          [categoryId]: prodData as Product[],
        };
      }
    }
  });

  // Загружаем товары, когда меняется selectedCategory или refresh
  useTask$(async ({ track }) => {
    track(() => selectedCategory.value);
    track(() => productUpdate.value.refresh);
    if (!selectedCategory.value) return;

    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, category_id")
      .eq("category_id", selectedCategory.value)
      .order("name");

    if (error || !data) return;
    products.value = {
      ...products.value,
      [selectedCategory.value]: data as Product[],
    };
  });

  const toggleCategory = $(async (categoryId: string) => {
    if (isCategoryOpen.value[categoryId]) {
      isCategoryOpen.value = { ...isCategoryOpen.value, [categoryId]: false };
      selectedCategory.value = null;
    } else {
      isCategoryOpen.value = { ...isCategoryOpen.value, [categoryId]: true };
      selectedCategory.value = categoryId;
    }
  });

  // Функция открытия модального окна удаления
  const openDeleteModal = $(async (type: 'category' | 'product', id: string, name: string) => {
    if (type === 'category') {
      // Получаем товары в категории для информации
      const { data: productsInCategory } = await supabase
        .from("products")
        .select("id, name")
        .eq("category_id", id);
      
      deleteModalData.value = {
        type,
        id,
        name,
        productCount: productsInCategory?.length || 0,
        productNames: productsInCategory?.slice(0, 3).map(p => p.name) || [] // Берем только 3 названия для показа
      };
    } else {
      deleteModalData.value = {
        type,
        id,
        name
      };
    }
  });

  // Функция закрытия модального окна
  const closeDeleteModal = $(() => {
    deleteModalData.value = null;
    deleting.value = false;
  });

  // Функция удаления
  const performDelete = $(async () => {
    if (!deleteModalData.value || deleting.value) return;
    
    deleting.value = true;
    
    try {
      if (deleteModalData.value.type === 'category') {
        // Сначала удаляем все товары в категории
        const { error: deleteProductsError } = await supabase
          .from("products")
          .delete()
          .eq("category_id", deleteModalData.value.id);
        
        if (deleteProductsError) {
          throw new Error("Ошибка при удалении товаров категории: " + deleteProductsError.message);
        }

        // Затем удаляем саму категорию
        const { error: deleteCategoryError } = await supabase
          .from("categories")
          .delete()
          .eq("id", deleteModalData.value.id);
        
        if (deleteCategoryError) {
          throw new Error("Ошибка при удалении категории: " + deleteCategoryError.message);
        }

        // Обновляем список категорий
        categories.value = categories.value.filter(cat => cat.id !== deleteModalData.value!.id);
        
      } else {
        // Удаление товара
        const { error } = await supabase
          .from("products")
          .delete()
          .eq("id", deleteModalData.value.id);
        
        if (error) {
          throw new Error("Ошибка при удалении товара: " + error.message);
        }

        // Обновляем список товаров для текущей категории
        const categoryId = selectedCategory.value;
        if (categoryId && products.value[categoryId]) {
          products.value = {
            ...products.value,
            [categoryId]: products.value[categoryId].filter(p => p.id !== deleteModalData.value!.id),
          };
        }

        // Если удаленный товар был активным, перенаправляем на главную
        const currentSlug = activeProductSlug.value;
        if (currentSlug) {
          const deletedProduct = products.value[categoryId || '']?.find(p => p.id === deleteModalData.value!.id);
          if (deletedProduct?.slug === currentSlug) {
            nav("/");
          }
        }
      }

      // Обновляем контекст
      productUpdate.value.refresh++;
      closeDeleteModal();
      
    } catch (err) {
      alert((err as Error).message);
      closeDeleteModal();
    }
  });

  return (
    <>
      {/* Модальное окно удаления */}
      {deleteModalData.value && (
        <div 
          class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          style={{
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div 
            class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden max-h-[90vh] flex flex-col"
            style={{
              animation: 'slideIn 0.3s ease-out'
            }}
          >
            {/* Заголовок */}
            <div class="p-6 border-b border-gray-200">
              <div class="flex items-center gap-3 mb-4">
                <div class={`w-12 h-12 rounded-full flex items-center justify-center ${
                  deleteModalData.value.type === 'category' && deleteModalData.value.productCount! > 0 
                    ? "bg-orange-100" 
                    : "bg-red-100"
                }`}>
                  {deleteModalData.value.type === 'category' && deleteModalData.value.productCount! > 0 ? (
                    <svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.406 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  ) : (
                    <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </div>
                <div>
                  <h2 class="text-xl font-bold text-gray-900">
                    {deleteModalData.value.type === 'category' 
                      ? 'Удалить категорию?' 
                      : 'Удалить товар?'}
                  </h2>
                  <p class="text-sm text-gray-600 mt-1">
                    {deleteModalData.value.type === 'category' 
                      ? 'Будет удалена категория и все связанные данные'
                      : 'Будет удален товар из базы данных'}
                  </p>
                </div>
              </div>
            </div>

            {/* Контент */}
            <div class="p-6 overflow-y-auto flex-1">
              {deleteModalData.value.type === 'category' && deleteModalData.value.productCount! > 0 ? (
                <div class="space-y-6">
                  {/* Предупреждение о товарах */}
                  <div class="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div class="flex items-center gap-2 mb-3">
                      <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.406 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <h3 class="font-semibold text-orange-800">Внимание!</h3>
                    </div>
                    <p class="text-sm text-orange-700 mb-3">
                      В этой категории есть <span class="font-bold">{deleteModalData.value.productCount}</span> товаров, которые также будут удалены.
                    </p>
                    
                    {/* Примеры товаров */}
                    {deleteModalData.value.productNames!.length > 0 && (
                      <div class="mt-3">
                        <p class="text-xs font-medium text-orange-700 mb-2">Товары:</p>
                        <div class="space-y-1">
                          {deleteModalData.value.productNames!.map((productName, index) => (
                            <div key={index} class="text-xs text-orange-600 bg-orange-100 px-3 py-1 rounded">
                              • {productName}
                            </div>
                          ))}
                          {deleteModalData.value.productCount! > 3 && (
                            <div class="text-xs text-orange-500 italic">
                              ...и еще {deleteModalData.value.productCount! - 3} товаров
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Подтверждение */}
                  <div class="text-center">
                    <div class="text-lg font-medium text-gray-800 mb-4">
                      Вы уверены, что хотите удалить категорию
                    </div>
                    <div class="text-2xl font-bold text-red-600 mb-2">
                      "{deleteModalData.value.name}"?
                    </div>
                    <p class="text-sm text-gray-600 mb-6">
                      Это действие нельзя отменить. Все данные будут удалены навсегда.
                    </p>
                  </div>

                  <div class="flex gap-3">
                    <button
                      onClick$={closeDeleteModal}
                      disabled={deleting.value}
                      class="flex-1 py-3 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50"
                    >
                      Отмена
                    </button>
                    <button
                      onClick$={performDelete}
                      disabled={deleting.value}
                      class="flex-1 py-3 px-4 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {deleting.value ? (
                        <>
                          <div 
                            class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"
                            style={{
                              animation: 'spin 1s linear infinite'
                            }}
                          ></div>
                          Удаление...
                        </>
                      ) : (
                        <>
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Удалить все
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div class="space-y-6">
                  <div class="text-center">
                    <div class="text-lg font-medium text-gray-800 mb-2">
                      Вы уверены, что хотите удалить
                    </div>
                    <div class="text-2xl font-bold text-red-600 mb-4">
                      "{deleteModalData.value.name}"?
                    </div>
                    <p class="text-sm text-gray-600">
                      Это действие нельзя отменить. Все данные будут удалены навсегда.
                    </p>
                  </div>

                  <div class="flex gap-3">
                    <button
                      onClick$={closeDeleteModal}
                      disabled={deleting.value}
                      class="flex-1 py-3 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50"
                    >
                      Отмена
                    </button>
                    <button
                      onClick$={performDelete}
                      disabled={deleting.value}
                      class="flex-1 py-3 px-4 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {deleting.value ? (
                        <>
                          <div 
                            class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"
                            style={{
                              animation: 'spin 1s linear infinite'
                            }}
                          ></div>
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* Встроенные стили для анимаций */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-20px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .animate-spin {
            animation: spin 1s linear infinite;
          }
        `}
      </style>

      <div class="w-full">
        {/* Заголовок */}
        <div class="mb-6">
          <h2 class="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Категории товаров
          </h2>
          <p class="text-sm text-gray-500">
            {categories.value.length} категорий
          </p>
        </div>

        {/* Список категорий */}
        <div class="space-y-2">
          {categories.value.map((cat) => (
            <div key={cat.id} class="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100 hover:border-gray-200 transition-all duration-200 group">
              {/* Заголовок категории */}
              <div class="flex items-center justify-between">
                <button
                  onClick$={() => toggleCategory(cat.id)}
                  class={`flex-1 flex items-center justify-between p-4 text-left transition-colors duration-200 ${
                    selectedCategory.value === cat.id
                      ? "bg-blue-50 text-blue-700"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <div class="flex items-center gap-3">
                    <div class={`w-2 h-2 rounded-full transition-colors duration-200 ${
                      selectedCategory.value === cat.id ? "bg-blue-500" : "bg-gray-300"
                    }`}></div>
                    <div class="font-medium truncate">{cat.name}</div>
                  </div>
                  <div class="flex items-center gap-2">
                    {/* Счетчик товаров */}
                    <span class={`text-xs px-2 py-1 rounded-full ${
                      selectedCategory.value === cat.id
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {products.value[cat.id]?.length || 0}
                    </span>
                    {/* Стрелка */}
                    <svg 
                      class={`w-4 h-4 transform transition-transform duration-200 ${
                        isCategoryOpen.value[cat.id] ? "rotate-180" : "rotate-0"
                      } ${selectedCategory.value === cat.id ? "text-blue-500" : "text-gray-400"}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                
                {/* Кнопка удаления категории */}
                <button
                  onClick$={() => openDeleteModal('category', cat.id, cat.name)}
                  class="p-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all duration-200"
                  title="Удалить категорию"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Список товаров категории */}
              {isCategoryOpen.value[cat.id] && selectedCategory.value === cat.id && (
                <div class="border-t border-gray-100 bg-gray-50">
                  {products.value[cat.id]?.length === 0 ? (
                    <div class="p-4 text-center">
                      <div class="text-gray-400 mb-2">
                        <svg class="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <p class="text-sm text-gray-500">Нет товаров в этой категории</p>
                      <button
                        onClick$={() => nav(`/product/new`)}
                        class="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        + Добавить первый товар
                      </button>
                    </div>
                  ) : (
                    <div class="py-2">
                      <div class="px-4 py-2 text-xs text-gray-500 font-medium border-b border-gray-200 flex justify-between items-center">
                        <span>Товары ({products.value[cat.id].length})</span>
                        <button
                          onClick$={() => nav(`/product/new`)}
                          class="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          title="Добавить товар в эту категорию"
                        >
                          + Добавить
                        </button>
                      </div>
                      <div class="max-h-60 overflow-y-auto">
                        {products.value[cat.id].map((product) => (
                          <div
                            key={product.id}
                            class={`group/item flex items-center gap-3 p-3 border-b border-gray-100 last:border-b-0 transition-colors duration-200 ${
                              activeProductSlug.value === product.slug
                                ? "bg-blue-100 border-l-4 border-l-blue-500"
                                : "hover:bg-gray-100"
                            }`}
                          >
                            {/* Основной контент товара */}
                            <button
                              onClick$={() => nav(`/product/${product.slug}`)}
                              class="flex-1 flex items-center gap-3 text-left min-w-0"
                            >
                              {/* Иконка товара */}
                              <div class={`w-6 h-6 flex items-center justify-center rounded ${
                                activeProductSlug.value === product.slug
                                  ? "bg-blue-500 text-white"
                                  : "bg-gray-200 text-gray-600 group-hover/item:bg-gray-300"
                              }`}>
                                {activeProductSlug.value === product.slug ? (
                                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                  </svg>
                                ) : (
                                  <div class="w-1.5 h-1.5 rounded-full bg-current"></div>
                                )}
                              </div>
                              
                              {/* Название товара */}
                              <div class="flex-1 min-w-0">
                                <div class={`text-sm font-medium truncate ${
                                  activeProductSlug.value === product.slug
                                    ? "text-blue-700"
                                    : "text-gray-700"
                                }`}>
                                  {product.name}
                                </div>
                                <div class="text-xs text-gray-500 truncate">
                                  /{product.slug}
                                </div>
                              </div>
                            </button>
                            
                            {/* Кнопка удаления товара */}
                            <button
                              onClick$={() => openDeleteModal('product', product.id, product.name)}
                              class="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover/item:opacity-100 transition-all duration-200"
                              title="Удалить товар"
                            >
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                            
                            {/* Стрелка */}
                            <svg 
                              class={`w-4 h-4 transition-opacity duration-200 ${
                                activeProductSlug.value === product.slug
                                  ? "text-blue-500 opacity-100"
                                  : "text-gray-400 opacity-0 group-hover/item:opacity-100"
                              }`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Пустое состояние */}
        {categories.value.length === 0 && (
          <div class="bg-gray-50 rounded-lg p-6 text-center">
            <div class="text-gray-400 mb-3">
              <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 class="text-gray-700 font-medium mb-2">Нет категорий</h3>
            <p class="text-sm text-gray-500 mb-4">
              Создайте первую категорию для организации товаров
            </p>
          </div>
        )}
      </div>
    </>
  );
});