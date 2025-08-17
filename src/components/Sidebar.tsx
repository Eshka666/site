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
};

export default component$(() => {
  const categories = useSignal<Category[]>([]);
  const selectedCategory = useSignal<string | null>(null);
  const products = useSignal<{ [key: string]: Product[] }>({});
  const isCategoryOpen = useSignal<{ [key: string]: boolean }>({});
  const nav = useNavigate();

  // Загружаем категории при загрузке компонента
  useTask$(async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug");

    if (error || !data) return;
    categories.value = data as Category[];
  });

  // Загружаем товары при изменении выбранной категории
  useTask$(async ({ track }) => {
    track(() => selectedCategory.value);

    if (!selectedCategory.value) return;

    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, category_id")
      .eq("category_id", selectedCategory.value);

    if (error || !data) return;

    products.value[selectedCategory.value] = data as Product[];
  });

  const toggleCategory = $(async (categoryId: string) => {
    if (isCategoryOpen.value[categoryId]) {
      isCategoryOpen.value[categoryId] = false;
      selectedCategory.value = null;
    } else {
      isCategoryOpen.value[categoryId] = true;
      selectedCategory.value = categoryId;
    }
  });

  return (
    <aside class="bg-gray-200 p-4">
      <div class="mb-4">
        <button
          onClick$={() => nav(`/product/new`)}
          class="bg-blue-500 text-white p-2 rounded"
        >
          ➕ Добавить новый товар
        </button>
      </div>

      <h2 class="text-xl font-semibold mb-4">Категории:</h2>
      <ul>
        {categories.value.map((cat) => (
          <li key={cat.id} class="mb-2">
            <button
              onClick$={() => toggleCategory(cat.id)}
              class={`${
                selectedCategory.value === cat.id
                  ? "font-bold text-blue-700"
                  : "text-blue-500"
              } hover:underline`}
            >
              {cat.name}
            </button>
            {isCategoryOpen.value[cat.id] &&
              selectedCategory.value === cat.id && (
                <div class="mt-2 pl-4">
                  {products.value[cat.id]?.length === 0 ? (
                    <p>Нет товаров в этой категории</p>
                  ) : (
                    <ul>
                      {products.value[cat.id].map((product) => (
                        <li key={product.id} class="mb-1">
                          <button
                            onClick$={() => nav(`/product/${product.slug}`)}
                            class="text-gray-700 hover:underline"
                          >
                            {product.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
          </li>
        ))}
      </ul>
    </aside>
  );
});
