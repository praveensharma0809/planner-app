// "use client";

// export default function SignupPage() {
//   return (
//     <div className="min-h-screen flex items-center justify-center bg-black text-white">
//       <div className="w-full max-w-md bg-neutral-900 p-8 rounded-2xl shadow-xl">
//         <h1 className="text-2xl font-semibold mb-6 text-center">
//           Create Account
//         </h1>

//         <form className="space-y-4">
//           <input
//             type="email"
//             placeholder="Email"
//             className="w-full p-3 rounded-lg bg-neutral-800 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-white"
//           />

//           <input
//             type="password"
//             placeholder="Password"
//             className="w-full p-3 rounded-lg bg-neutral-800 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-white"
//           />

//           <button
//             type="submit"
//             className="w-full p-3 rounded-lg bg-white text-black font-medium hover:bg-gray-200 transition"
//           >
//             Sign Up
//           </button>
//         </form>
//       </div>
//     </div>
//   );
// }

"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Check your email to confirm your account.");
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-md bg-neutral-900 p-8 rounded-2xl shadow-xl">
        <h1 className="text-2xl font-semibold mb-6 text-center">
          Create Account
        </h1>

        <form className="space-y-4" onSubmit={handleSignup}>
          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 rounded-lg bg-neutral-800 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 rounded-lg bg-neutral-800 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-white"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            className="w-full p-3 rounded-lg bg-white text-black font-medium hover:bg-gray-200 transition"
          >
            Sign Up
          </button>
        </form>
      </div>
    </div>
  );
}
