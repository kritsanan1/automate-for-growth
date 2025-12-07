import Image from 'next/image'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 bg-white sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <div className="sm:text-center lg:text-left">
                <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                  <span className="block xl:inline">Automate Your</span>{' '}
                  <span className="block text-indigo-600 xl:inline">Content Creation</span>
                </h1>
                <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                  Generate weeks of content in minutes with AI-powered tools. Create professional videos, 
                  manage 8+ social platforms, and build brand authority automatically.
                </p>
                <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                  <div className="rounded-md shadow">
                    <a
                      href="#"
                      className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 md:py-4 md:text-lg md:px-10"
                    >
                      Get Started
                    </a>
                  </div>
                  <div className="mt-3 sm:mt-0 sm:ml-3">
                    <a
                      href="#"
                      className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 md:py-4 md:text-lg md:px-10"
                    >
                      Learn More
                    </a>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
        <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
          <div className="h-56 w-full bg-gray-300 sm:h-72 md:h-96 lg:w-full lg:h-full">
            <div className="w-full h-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center">
              <div className="text-center text-white">
                <h2 className="text-4xl font-bold mb-4">🚀</h2>
                <p className="text-xl">AI-Powered Content Creation</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-indigo-600 font-semibold tracking-wide uppercase">Features</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to scale your content
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
              From AI content generation to multi-platform publishing, we have everything you need to automate your content workflow.
            </p>
          </div>

          <div className="mt-10">
            <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white">
                    📝
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Bulk Content Generation</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-500">
                  Generate 10, 20, or 50+ posts in minutes with AI-powered content creation that matches your brand voice.
                </dd>
              </div>

              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white">
                    🎥
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">AI Video Creation</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-500">
                  Create professional videos from text with Sora integration. 70% cost savings compared to alternatives.
                </dd>
              </div>

              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white">
                    🎯
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Brand Authority</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-500">
                  Automatically place your personal images in AI-generated content to build consistent brand recognition.
                </dd>
              </div>

              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white">
                    📱
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Multi-Platform Publishing</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-500">
                  Publish to 8+ platforms including Instagram, Facebook, LinkedIn, TikTok, YouTube, Pinterest, Threads, and WordPress.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </main>
  )
}