import RevenueCalculator from "./components/RevenueCalculator";
import PassengerCargoRoller from "./components/PassengerCargoRoller";

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
            Roll available passengers and cargo for a jump, then enter the
            actual bookings below to calculate total revenue.
          </p>
        </header>

        <PassengerCargoRoller />

        <RevenueCalculator />
      </div>
    </main>
  );
}
