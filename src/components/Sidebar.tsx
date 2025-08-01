import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { supabase } from "~/lib/supabase";

type Product = {
  id: string;
  name: string;
  slug: string;
};

export default component$(() => {
  const products = useSignal<Product[]>([]);

  useTask$(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug");

    if (error || !data) return;

    products.value = data as Product[];
  });

  return (
    <aside class="bg-gray-200 p-4 ">
      <div class="mb-4">
        <Link href="/product/new" class="bg-blue-500 text-white p-2 rounded">
          ➕ Добавить новый товар
        </Link>
      </div>

      <h2 class="text-xl font-semibold mb-4">Товары</h2>
      <ul>
        {products.value.map((product) => (
          <li key={product.id} class="mb-2">
            <Link
              href={`/product/${product.slug}`}
              class="text-blue-500 hover:underline"
            >
              {product.name}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
});
