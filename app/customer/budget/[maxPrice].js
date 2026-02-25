import { Redirect, useLocalSearchParams } from "expo-router";

export default function BudgetProductsRedirect() {
  const { maxPrice } = useLocalSearchParams();
  const value = Array.isArray(maxPrice) ? maxPrice[0] : maxPrice;
  const normalized = Number(value);

  return (
    <Redirect
      href={{
        pathname: "/customer/product",
        params: Number.isFinite(normalized) && normalized > 0
          ? { maxPrice: String(normalized) }
          : {},
      }}
    />
  );
}
