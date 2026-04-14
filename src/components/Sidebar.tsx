import {
  component$,
  useSignal,
  useTask$,
} from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";
import { supabase } from "~/lib/supabase";
import Category from "./Category";

type Category = {
  id: string;
  name: string;
  slug: string;
};

export default component$(() => {
  const categories = useSignal<Category[]>([]);
  const totalProducts = useSignal(0);
  const nav = useNavigate();

  // Загружаем категории и общее количество товаров
  useTask$(async () => {
    // Загружаем категории
    const { data: categoriesData } = await supabase
      .from("categories")
      .select("id, name, slug")
      .order("name");
    
    if (categoriesData) {
      categories.value = categoriesData as Category[];
    }

    // Загружаем общее количество товаров
    const { count } = await supabase
      .from("products")
      .select("*", { count: 'exact', head: true });
    
    if (count !== null) {
      totalProducts.value = count;
    }
  });

  return (
    <aside class="w-80 min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 border-r border-gray-200 flex flex-col">
      {/* Заголовок */}
      <div class="p-6 border-b border-gray-200 bg-white">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <div>
            <h1 class="text-xl font-bold text-gray-900">Каталог товаров</h1>
            <p class="text-sm text-gray-500">Управление товарами и категориями</p>
          </div>
        </div>

        {/* Кнопка добавления товара */}
        <button
          onClick$={() => nav(`/product/new`)}
          class="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Добавить новый товар
        </button>
      </div>

      {/* Контент */}
      <div class="flex-1 overflow-y-auto">
        <div class="p-6">
          <Category />
        </div>
      </div>

      {/* Футер */}
      <div class="p-6 border-t border-gray-200 bg-white">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-600">Всего категорий</div>
            <div class="text-lg font-bold text-gray-900">{categories.value.length}</div>
          </div>
          <div class="text-right">
            <div class="text-sm text-gray-600">Всего товаров</div>
            <div class="text-lg font-bold text-gray-900">{totalProducts.value}</div>
          </div>
        </div>
      </div>
    </aside>
  );
});