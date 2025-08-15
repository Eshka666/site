import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";
import { supabase } from "~/lib/supabase";

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  image_url: string;
  price: number;
  currency: string;
}

export default component$(() => {
  const loc = useLocation();
  const slug = loc.params.slug;

  const product = useSignal<Product | null>(null);

  useTask$(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error) {
      console.error("Ошибка загрузки товара: ", error.message);
      return;
    }

    product.value = data;
  });

  if (!product.value) {
    return (
      <div class="text-center text-red-500 font-semibold mt-8">
        Товар не найден
      </div>
    );
  }

  return (
    <div class="max-w-2xl mx-auto p-6 bg-white shadow-lg rounded-lg">
      <h1 class="text-3xl font-bold text-center text-gray-800 mb-6">
        {product.value.name}
      </h1>

      <div class="flex justify-center mb-6">
        <img
          src={product.value.image_url}
          alt={product.value.name}
          class="rounded-lg border border-gray-200"
          width={300}
          height={300}
        />
      </div>

      <p class="text-gray-700 text-lg mb-4">
        Описание: {product.value.description}
      </p>

      <p class="text-xl font-semibold text-gray-800 mb-4">
        Цена: {product.value.price} {product.value.currency}
      </p>

      <h2 class="text-xl font-semibold text-gray-800 mb-4">QR-код</h2>
      <div class="flex justify-center mb-4">
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://yourdomain.com/product/${slug}`}
          alt="QR Code"
          class="rounded-lg border border-gray-200"
          width={200}
          height={200}
        />
      </div>

      <p class="text-sm text-gray-500 text-center">
        Отсканируйте, чтобы открыть товар
      </p>

      <div class="text-center mt-6">
        <button
          onClick$={() => history.back()}
          class="bg-gray-300 text-gray-800 hover:bg-gray-400 py-2 px-4 rounded-md font-semibold transition duration-300"
        >
          Назад
        </button>
      </div>
    </div>
  );
});
