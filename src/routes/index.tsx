import { component$, useSignal, useTask$, $ } from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";
import { supabase } from "~/lib/supabase";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  price: number;
  currency: string;
  image_url: string;
};

export default component$(() => {
  const categories = useSignal<Category[]>([]);
  const productsByCategory = useSignal<{ [key: string]: Product[] }>({});
  const selectedCategory = useSignal<string | null>(null);
  const loading = useSignal(true);
  const nav = useNavigate();

  // Загружаем категории и товары
  useTask$(async () => {
    loading.value = true;
    
    try {
      // Загружаем категории
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("id, name, slug")
        .order("name");

      if (categoriesError) {
        console.error("Ошибка загрузки категорий:", categoriesError);
        return;
      }

      if (categoriesData) {
        categories.value = categoriesData as Category[];
      }

      // Загружаем товары для каждой категории
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, slug, category_id, price, currency, image_url")
        .order("name");

      if (productsError) {
        console.error("Ошибка загрузки товаров:", productsError);
        return;
      }

      if (productsData) {
        const products = productsData as Product[];
        const grouped: { [key: string]: Product[] } = {};
        
        // Группируем товары по категориям
        products.forEach(product => {
          if (!grouped[product.category_id]) {
            grouped[product.category_id] = [];
          }
          grouped[product.category_id].push(product);
        });
        
        productsByCategory.value = grouped;
      }
    } finally {
      loading.value = false;
    }
  });

  // Получаем первую фотографию товара
  // const getFirstImage = $((imageUrlString: string): string => {
  //   if (!imageUrlString) return '';
  //   return imageUrlString.split(',')[0].trim();
  // });

  const selectCategory = $((categoryId: string) => {
    selectedCategory.value = categoryId;
  });

  if (loading.value) {
    return (
      <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
          <p class="text-gray-600">Загрузка каталога...</p>
        </div>
      </div>
    );
  }

  const totalProducts = Object.values(productsByCategory.value).reduce(
    (sum, products) => sum + products.length, 0
  );

  return (
    <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Герой-секция */}
      <div class="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-12 px-4">
        <div class="max-w-7xl mx-auto">
          <div class="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div class="lg:w-2/3">
              <h1 class="text-4xl lg:text-5xl font-bold mb-4">
                Добро пожаловать в каталог товаров
              </h1>
              <p class="text-lg lg:text-xl text-blue-100 mb-6">
                Управляйте товарами, категориями и создавайте новые записи в одном месте
              </p>
              <div class="flex flex-wrap gap-4">
                <div class="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                  <div class="text-2xl font-bold">{categories.value.length}</div>
                  <div class="text-sm">Категорий</div>
                </div>
                <div class="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                  <div class="text-2xl font-bold">{totalProducts}</div>
                  <div class="text-sm">Товаров</div>
                </div>
              </div>
            </div>
            <div class="lg:w-1/3">
              <button
                onClick$={() => nav(`/product/new`)}
                class="w-full bg-white text-blue-600 hover:bg-gray-100 font-bold text-lg py-4 px-6 rounded-xl shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-1 flex items-center justify-center gap-3"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Добавить новый товар
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="max-w-7xl mx-auto px-4 py-8">
        {/* Быстрые действия */}
        <div class="mb-8">
          <h2 class="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Быстрые действия
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick$={() => nav(`/product/new`)}
              class="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-200 hover:border-blue-300 text-left group"
            >
              <div class="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 class="font-bold text-gray-800 mb-2">Добавить товар</h3>
              <p class="text-sm text-gray-600">Создайте новый товар с фото и описанием</p>
            </button>

            <button
              onClick$={() => {
                // Можно добавить функционал создания категории
                alert("Функционал создания категории будет добавлен позже");
              }}
              class="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-200 hover:border-green-300 text-left group"
            >
              <div class="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 class="font-bold text-gray-800 mb-2">Создать категорию</h3>
              <p class="text-sm text-gray-600">Добавьте новую категорию для товаров</p>
            </button>

            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 shadow-lg border border-blue-100">
              <div class="w-12 h-12 rounded-lg bg-blue-500 flex items-center justify-center mb-4">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 class="font-bold text-gray-800 mb-2">Все готово!</h3>
              <p class="text-sm text-gray-600">
                {totalProducts === 0 
                  ? "Начните с добавления первого товара"
                  : `У вас ${totalProducts} товаров в ${categories.value.length} категориях`}
              </p>
            </div>
          </div>
        </div>

        {/* Категории и товары */}
        <div class="mb-8">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Категории товаров
            </h2>
            <div class="text-sm text-gray-500">
              {categories.value.length} категорий • {totalProducts} товаров
            </div>
          </div>

          {categories.value.length === 0 ? (
            <div class="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-300">
              <div class="w-24 h-24 mx-auto mb-6 text-gray-300">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 class="text-xl font-bold text-gray-700 mb-3">Нет категорий</h3>
              <p class="text-gray-500 mb-6 max-w-md mx-auto">
                Создайте первую категорию для организации ваших товаров. Категории помогут структурировать ваш каталог.
              </p>
              <button
                onClick$={() => {
                  alert("Функционал создания категории будет добавлен позже");
                }}
                class="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Создать первую категорию
              </button>
            </div>
          ) : (
            <div class="space-y-6">
              {categories.value.map((category) => {
                const categoryProducts = productsByCategory.value[category.id] || [];
                const categoryHasProducts = categoryProducts.length > 0;
                
                return (
                  <div key={category.id} class="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
                    {/* Заголовок категории */}
                    <div class="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4">
                          <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                          </div>
                          <div>
                            <h3 class="text-xl font-bold text-gray-800">{category.name}</h3>
                            <p class="text-sm text-gray-500">
                              {categoryHasProducts 
                                ? `${categoryProducts.length} товаров` 
                                : "Нет товаров"}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick$={() => selectCategory(category.id)}
                          class={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            selectedCategory.value === category.id
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {selectedCategory.value === category.id ? "Выбрана" : "Показать"}
                        </button>
                      </div>
                    </div>

                    {/* Товары категории */}
                    {(selectedCategory.value === category.id || !categoryHasProducts) && (
                      <div class="p-6 bg-gray-50">
                        {!categoryHasProducts ? (
                          <div class="text-center py-8">
                            <div class="text-gray-400 mb-3">
                              <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                              </svg>
                            </div>
                            <h4 class="text-lg font-medium text-gray-700 mb-2">Нет товаров в этой категории</h4>
                            <p class="text-gray-500 mb-4">Добавьте первый товар в эту категорию</p>
                            <button
                              onClick$={() => nav(`/product/new`)}
                              class="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
                            >
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              Добавить товар
                            </button>
                          </div>
                        ) : (
                          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {categoryProducts.map((product) => {
                              const firstImage = product.image_url?.split(',')[0]?.trim() || '';
                              
                              return (
                                <div 
                                  key={product.id}
                                  class="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-200 border border-gray-200 hover:border-blue-300 group cursor-pointer"
                                  onClick$={() => nav(`/product/${product.slug}`)}
                                >
                                  {/* Изображение товара */}
                                  <div class="relative h-48 bg-gray-100 overflow-hidden">
                                    {firstImage ? (
                                      <img
                                        src={firstImage}
                                        alt={product.name}
                                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        height={100}
                                        width={100}
                                      />
                                    ) : (
                                      <div class="w-full h-full flex items-center justify-center text-gray-400">
                                        <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                      </div>
                                    )}
                                    <div class="absolute top-3 right-3 bg-black/70 text-white text-xs font-semibold px-2 py-1 rounded">
                                      {product.currency} {product.price.toFixed(2)}
                                    </div>
                                  </div>
                                  
                                  {/* Информация о товаре */}
                                  <div class="p-4">
                                    <h4 class="font-bold text-gray-800 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                                      {product.name}
                                    </h4>
                                    <div class="flex items-center justify-between">
                                      <span class="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                        /{product.slug}
                                      </span>
                                      <span class="text-blue-600 font-medium">
                                        Подробнее →
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Статистика */}
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
          <h3 class="text-xl font-bold text-gray-800 mb-6 text-center">
            Статистика каталога
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="bg-white rounded-xl p-6 text-center shadow">
              <div class="text-3xl font-bold text-blue-600 mb-2">{categories.value.length}</div>
              <div class="text-gray-700 font-medium">Категорий</div>
            </div>
            <div class="bg-white rounded-xl p-6 text-center shadow">
              <div class="text-3xl font-bold text-green-600 mb-2">{totalProducts}</div>
              <div class="text-gray-700 font-medium">Всего товаров</div>
            </div>
            <div class="bg-white rounded-xl p-6 text-center shadow">
              <div class="text-3xl font-bold text-purple-600 mb-2">
                {categories.value.length > 0 
                  ? (totalProducts / categories.value.length).toFixed(1)
                  : "0"}
              </div>
              <div class="text-gray-700 font-medium">Товаров на категорию</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});