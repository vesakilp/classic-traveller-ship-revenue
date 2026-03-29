import RevenueCalculator from "./components/RevenueCalculator";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 dark:bg-gray-950 py-10 px-4">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            ⭐ Classic Traveller
          </h1>
          <p className="text-lg text-amber-700 dark:text-amber-400 font-medium">
            Ship Revenue Calculator
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enter the number of passengers and cargo tonnage to calculate total
            revenue for a single jump.
          </p>
        </header>

        <RevenueCalculator />
      </div>
    </main>
  );
}
