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
  const activeProductSlug = useSignal<string | null>(null);
  const nav = useNavigate();
  const location = useLocation();

  const productUpdate = useContext(ProductUpdateContext);

  // Загружаем категории при монтировании
  useTask$(async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug");
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
        .eq("category_id", categoryId);

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
      .eq("category_id", selectedCategory.value);

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

  return (
    <aside class="bg-gray-200 p-4 w-64 min-h-screen">
      <div class="mb-4">
        <button
          onClick$={() => nav(`/product/new`)}
          class="bg-blue-500 text-white p-2 rounded w-full"
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
                    <p class="text-gray-500 text-sm">
                      Нет товаров в этой категории
                    </p>
                  ) : (
                    <ul>
                      {products.value[cat.id].map((product) => (
                        <li key={product.id} class="mb-1">
                          <button
                            onClick$={() => nav(`/product/${product.slug}`)}
                            class={`hover:underline ${
                              activeProductSlug.value === product.slug
                                ? "text-blue-600 font-bold"
                                : "text-gray-700"
                            }`}
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
