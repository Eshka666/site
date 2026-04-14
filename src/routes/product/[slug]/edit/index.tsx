import {
  component$,
  useSignal,
  $,
  noSerialize,
  type NoSerialize,
  useTask$,
  useContext,
} from "@builder.io/qwik";
import { useLocation, useNavigate, routeLoader$ } from "@builder.io/qwik-city";
import { supabase } from "~/lib/supabase";
import { ProductUpdateContext } from "~/context/product-context";

// Используем routeLoader$ для загрузки данных ДО рендера компонента
export const useProductData = routeLoader$(async ({ params, fail }) => {
  try {
    // Загружаем товар и категории параллельно
    const [productResponse, categoriesResponse] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("slug", params.slug)
        .single(),
      supabase
        .from("categories")
        .select("id, name, slug")
        .order("name"),
    ]);

    if (productResponse.error) {
      return fail(404, { message: "Товар не найден" });
    }

    return {
      product: productResponse.data,
      categories: categoriesResponse.data || [],
      success: true,
    };
  } catch {
    return fail(500, { message: "Ошибка загрузки данных" });
  }
});

const generateSlug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

type Category = {
  id: string;
  name: string;
  slug: string;
};

type ImageFile = {
  id: string;
  file: NoSerialize<File> | null;
  previewUrl: string;
  existingUrl?: string;
};

export default component$(() => {
  const loc = useLocation();
  const nav = useNavigate();
  
  // Используем данные из loader
  const productData = useProductData();
  
  const name = useSignal("");
  const currency = useSignal("BYN");
  const price = useSignal("");
  const description = useSignal("");
  const imageFiles = useSignal<ImageFile[]>([]);
  const loading = useSignal(false);
  const error = useSignal("");
  const categories = useSignal<Category[]>([]);
  const selectedCategory = useSignal("");
  const newCategoryName = useSignal("");
  
  const productUpdate = useContext(ProductUpdateContext);

  // Используем useTask$ для инициализации данных из loader
  useTask$(({ track }) => {
    track(() => productData.value);
    
    if (!productData.value) return;
    
    // Проверяем на ошибку
    if (productData.value.failed) {
      error.value = productData.value.message || "Ошибка загрузки данных";
      return;
    }
    
    // Проверяем структуру данных
    if (!('product' in productData.value)) {
      error.value = "Некорректные данные товара";
      return;
    }
    
    const { product, categories: loadedCategories } = productData.value;
    
    // Инициализируем категории
    if (loadedCategories) {
      categories.value = loadedCategories as Category[];
    }
    
    // Инициализируем данные товара
    if (product) {
      name.value = product.name || "";
      description.value = product.description || "";
      price.value = product.price ? product.price.toString() : "";
      currency.value = product.currency || "BYN";
      
      // Устанавливаем выбранную категорию
      selectedCategory.value = product.category_id || "";
      
      // Загружаем существующие фото
      if (product.image_url && typeof product.image_url === 'string') {
        const existingUrls = product.image_url
          .split(',')
          .map((url: string) => url.trim())
          .filter((url: string) => url.length > 0);
        
        imageFiles.value = existingUrls.map((url: string, index: number) => ({
          id: `existing-${index}`,
          file: null,
          previewUrl: url,
          existingUrl: url,
        }));
      }
    }
  });

  // Проверяем состояние загрузки
  const isLoading = !productData.value;

  // Исправляем хендлер для select
  const handleSelectChange = $((e: Event) => {
    selectedCategory.value = (e.target as HTMLSelectElement).value;
  });

  const handleInputChange = (
    signal:
      | typeof name
      | typeof description
      | typeof price
      | typeof newCategoryName
      | typeof currency
  ) =>
    $((e: Event) => {
      signal.value = (e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
    });

  const onFilesChange = $((e: Event) => {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    
    if (!files || files.length === 0) return;
    
    const newImages: ImageFile[] = [];
    
    Array.from(files).forEach((file) => {
      const previewUrl = URL.createObjectURL(file);
      
      newImages.push({
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        file: noSerialize(file),
        previewUrl,
      });
    });
    
    imageFiles.value = [...imageFiles.value, ...newImages];
    input.value = "";
  });

  const removeImage = $((id: string) => {
    const imageToRemove = imageFiles.value.find(img => img.id === id);
    
    if (imageToRemove?.previewUrl && !imageToRemove.existingUrl) {
      URL.revokeObjectURL(imageToRemove.previewUrl);
    }
    
    imageFiles.value = imageFiles.value.filter(img => img.id !== id);
  });

  const moveImage = $((id: string, direction: 'up' | 'down') => {
    const index = imageFiles.value.findIndex(img => img.id === id);
    if (index === -1) return;
    
    const newImages = [...imageFiles.value];
    
    if (direction === 'up' && index > 0) {
      [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
      imageFiles.value = newImages;
    } else if (direction === 'down' && index < newImages.length - 1) {
      [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
      imageFiles.value = newImages;
    }
  });

  const onSubmit = $(async (e: Event) => {
    e.preventDefault();
    error.value = "";
    loading.value = true;

    try {
      // Проверки
      if (!name.value.trim()) {
        throw new Error("Введите название товара");
      }
      
      if (!price.value || parseFloat(price.value) <= 0) {
        throw new Error("Введите корректную цену");
      }
      
      if (!selectedCategory.value) {
        throw new Error("Пожалуйста, выберите категорию");
      }

      let categoryId = "";
      const uploadedImageUrls: string[] = [];

      // Загружаем новые фото и собираем существующие
      for (const imageFile of imageFiles.value) {
        if (imageFile.existingUrl) {
          uploadedImageUrls.push(imageFile.existingUrl);
        } else if (imageFile.file) {
          const ext = imageFile.file.name.split(".").pop();
          const fileName = `product-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
          
          const { error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(fileName, imageFile.file);
          
          if (uploadError) {
            throw new Error(`Ошибка загрузки изображения: ${uploadError.message}`);
          }

          const imageUrl = supabase.storage
            .from("product-images")
            .getPublicUrl(fileName).data.publicUrl;
          
          uploadedImageUrls.push(imageUrl);
        }
      }

      // Обработка категории
      if (selectedCategory.value === "new") {
        if (!newCategoryName.value.trim()) {
          throw new Error("Введите название новой категории");
        }

        const categorySlug = generateSlug(newCategoryName.value);
        let uniqueSlug = categorySlug;
        let count = 1;
        
        // Проверяем уникальность slug
        while (true) {
          const { data: existingCategory } = await supabase
            .from("categories")
            .select("id")
            .eq("slug", uniqueSlug)
            .maybeSingle();
          if (!existingCategory) break;
          uniqueSlug = `${categorySlug}-${count++}`;
        }

        const { data: newCat, error: catError } = await supabase
          .from("categories")
          .insert([{ name: newCategoryName.value, slug: uniqueSlug }])
          .select("id")
          .single();
          
        if (catError) throw new Error("Ошибка категории: " + catError.message);
        categoryId = newCat.id;
      } else {
        categoryId = selectedCategory.value;
      }

      // Генерируем новый slug если изменилось название
      const currentProduct = productData.value?.product;
      let slug = currentProduct?.slug || generateSlug(name.value);
      
      if (currentProduct && currentProduct.name !== name.value) {
        const baseSlug = generateSlug(name.value);
        let newSlug = baseSlug;
        let count = 1;
        
        while (true) {
          const { data: existingSlug } = await supabase
            .from("products")
            .select("id")
            .eq("slug", newSlug)
            .neq("slug", loc.params.slug)
            .maybeSingle();
          
          if (!existingSlug) {
            slug = newSlug;
            break;
          }
          newSlug = `${baseSlug}-${count++}`;
        }
      }

      // Обновляем товар
      const updateData = {
        name: name.value,
        slug,
        description: description.value,
        image_url: uploadedImageUrls.join(','),
        price: parseFloat(price.value),
        currency: currency.value,
        category_id: categoryId,
      };

      const { data: updated, error: updateError } = await supabase
        .from("products")
        .update(updateData)
        .eq("slug", loc.params.slug)
        .select("slug")
        .single();

      if (updateError) {
        console.error("Ошибка обновления:", updateError);
        throw new Error("Ошибка при сохранении: " + updateError.message);
      }

      if (updated) {
        productUpdate.value.refresh++;
        
        // Освобождаем память
        imageFiles.value.forEach(img => {
          if (img.previewUrl && !img.existingUrl) {
            URL.revokeObjectURL(img.previewUrl);
          }
        });
        
        // Перенаправляем
        await nav(`/product/${updated.slug}/`);
      }
    } catch (err) {
      error.value = (err as Error).message;
      console.error("Ошибка:", err);
    } finally {
      loading.value = false;
    }
  });

  // Проверяем загрузку данных
  if (isLoading) {
    return (
      <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
          <p class="text-gray-600">Загрузка товара для редактирования...</p>
        </div>
      </div>
    );
  }

  // Проверяем ошибки из loader
  if (productData.value?.failed || error.value) {
    const errorMessage = productData.value?.message || error.value || "Неизвестная ошибка";
    
    return (
      <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div class="text-center">
          <div class="text-red-500 mb-4">
            <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-gray-900 mb-2">Ошибка</h1>
          <p class="text-gray-600 mb-6">{errorMessage}</p>
          <button
            onClick$={() => nav("/")}
            class="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200"
          >
            Вернуться на главную
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div class="max-w-4xl mx-auto">
        {/* Хедер */}
        <div class="mb-8">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-4xl font-bold text-gray-900 mb-2">
                Редактирование товара
              </h1>
              <p class="text-gray-600">
                Измените информацию о товаре. Все изменения будут сохранены.
              </p>
            </div>
            <button
              onClick$={() => nav(`/product/${loc.params.slug}/`)}
              class="px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors duration-200 flex items-center gap-2"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Отмена
            </button>
          </div>
        </div>

        {/* Основная форма */}
        <div class="bg-white rounded-2xl shadow-xl overflow-hidden">
          <form preventdefault:submit onSubmit$={onSubmit} class="space-y-8 px-8 pb-8">
            {/* Секция 1: Основная информация */}
            <div class="space-y-6 pt-8">
              <div class="border-b border-gray-200 pb-6">
                <h2 class="text-xl font-semibold text-gray-800 mb-4">
                  Основная информация
                </h2>
                
                {/* Название товара */}
                <div class="mb-6">
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Название товара *
                  </label>
                  <input
                    type="text"
                    value={name.value}
                    onInput$={handleInputChange(name)}
                    required
                    class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Введите название товара"
                  />
                </div>

                {/* Описание */}
                <div class="mb-6">
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Описание товара
                  </label>
                  <textarea
                    value={description.value}
                    onInput$={handleInputChange(description)}
                    class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    rows={4}
                    placeholder="Опишите товар подробно..."
                  />
                </div>
              </div>

              {/* Секция 2: Категория */}
              <div class="border-b border-gray-200 pb-6">
                <h2 class="text-xl font-semibold text-gray-800 mb-4">
                  Категория
                </h2>
                
                <div class="mb-6">
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Выберите категорию *
                  </label>
                  <select
                    value={selectedCategory.value}
                    onChange$={handleSelectChange}
                    class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
                    required
                  >
                    <option value="">Выберите категорию</option>
                    <option value="new" class="font-semibold text-blue-600">
                      + Создать новую категорию
                    </option>
                    {categories.value.map((cat) => (
                      <option key={cat.id} value={cat.id} selected={selectedCategory.value === cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Поле для новой категории */}
                {selectedCategory.value === "new" && (
                  <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Название новой категории *
                    </label>
                    <input
                      type="text"
                      value={newCategoryName.value}
                      onInput$={handleInputChange(newCategoryName)}
                      placeholder="Например: Электроника, Одежда, Мебель..."
                      class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Секция 3: Фотографии */}
              <div class="border-b border-gray-200 pb-6">
                <h2 class="text-xl font-semibold text-gray-800 mb-4">
                  Фотографии товара
                </h2>
                
                <div class="mb-6">
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Загрузите фотографии
                  </label>
                  
                  {/* Красивая зона загрузки */}
                  <div class="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors duration-200">
                    <div class="flex flex-col items-center">
                      <svg class="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p class="text-gray-600 mb-2">
                        Добавьте новые фотографии или замените существующие
                      </p>
                      <p class="text-sm text-gray-500 mb-4">
                        Поддерживаются JPG, PNG, GIF. Максимум 10 файлов.
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange$={onFilesChange}
                        multiple
                        class="hidden"
                        id="file-upload-edit"
                      />
                      <label 
                        for="file-upload-edit"
                        class="px-6 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors duration-200 cursor-pointer"
                      >
                        Добавить файлы
                      </label>
                    </div>
                  </div>
                  
                  {/* Предпросмотр фото */}
                  {imageFiles.value.length > 0 && (
                    <div class="mt-8">
                      <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-medium text-gray-800">
                          Все фотографии ({imageFiles.value.length})
                        </h3>
                        <span class="text-sm text-gray-500">
                          Первое фото будет главным
                        </span>
                      </div>
                      
                      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {imageFiles.value.map((image, index) => (
                          <div key={image.id} class="relative group">
                            <div class="aspect-square overflow-hidden rounded-xl border-2 border-gray-200 group-hover:border-blue-400 transition-all duration-200">
                              <img
                                src={image.previewUrl}
                                alt={`Предпросмотр ${index + 1}`}
                                class="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-200"
                                height={100}
                                width={100}
                              />
                            </div>
                            
                            {image.existingUrl && (
                              <div class="absolute top-2 left-2 bg-green-500 text-white text-xs font-semibold rounded-full px-2 py-1">
                                Старое
                              </div>
                            )}
                            
                            <div class="absolute top-2 right-10 bg-black/80 text-white text-xs font-semibold rounded-full w-6 h-6 flex items-center justify-center">
                              {index + 1}
                            </div>
                            
                            <button
                              type="button"
                              onClick$={() => removeImage(image.id)}
                              class="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 transition-colors duration-200 opacity-0 group-hover:opacity-100"
                              title="Удалить фото"
                            >
                              ×
                            </button>
                            
                            {imageFiles.value.length > 1 && (
                              <div class="absolute bottom-2 left-2 right-2 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                {index > 0 && (
                                  <button
                                    type="button"
                                    onClick$={() => moveImage(image.id, 'up')}
                                    class="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-blue-700 transition-colors duration-200"
                                    title="Поднять выше"
                                  >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                                    </svg>
                                  </button>
                                )}
                                {index < imageFiles.value.length - 1 && (
                                  <button
                                    type="button"
                                    onClick$={() => moveImage(image.id, 'down')}
                                    class="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-blue-700 transition-colors duration-200"
                                    title="Опустить ниже"
                                  >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Секция 4: Цена и валюта */}
              <div>
                <h2 class="text-xl font-semibold text-gray-800 mb-4">
                  Цена и валюта
                </h2>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Цена */}
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Цена *
                    </label>
                    <div class="relative">
                      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span class="text-gray-500 sm:text-sm">₽</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={price.value}
                        onInput$={handleInputChange(price)}
                        required
                        class="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Валюта */}
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Валюта
                    </label>
                    <select
                      value={currency.value}
                      onChange$={handleInputChange(currency)}
                      class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
                    >
                      <option value="BYN">BYN (Белорусский рубль)</option>
                      <option value="USD">USD (Доллар США)</option>
                      <option value="EUR">EUR (Евро)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Сообщение об ошибке */}
            {error.value && (
              <div class="rounded-xl bg-red-50 border border-red-200 p-4">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div class="ml-3">
                    <h3 class="text-sm font-medium text-red-800">
                      Ошибка при сохранении
                    </h3>
                    <div class="mt-2 text-sm text-red-700">
                      <p>{error.value}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Кнопки действий */}
            <div class="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                type="button"
                onClick$={() => nav(`/product/${loc.params.slug}/`)}
                class="flex-1 px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Отменить
              </button>
              
              <button
                type="submit"
                disabled={loading.value}
                class="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-green-600 to-green-700 text-white font-medium hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              >
                {loading.value ? (
                  <>
                    <svg class="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Сохранение...
                  </>
                ) : (
                  <>
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Сохранить изменения
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div class="mt-8 text-center text-sm text-gray-500">
          <p>* — обязательные поля для заполнения</p>
          <p class="mt-1">Все изменения будут сохранены в базе данных</p>
        </div>
      </div>
    </div>
  );
});