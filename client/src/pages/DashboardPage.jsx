import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { useAuth } from '../context/AuthContext'

function DashboardPage() {
  const { user, session } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [dashboardData, setDashboardData] = useState({
    attempts: [],
    totalQuizzes: 0,
    averageScore: 0,
    recentAttempts: [],
    chartData: []
  })

  // Fetch dashboard data
  const fetchDashboardData = async (isRefresh = false) => {
    if (!user?.id) return

    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/attempts?userId=${user.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        const attempts = data.attempts || []
        
        // Process data for dashboard
        const processedData = processAttemptsData(attempts)
        setDashboardData(processedData)
      } else if (response.status === 404) {
        // No attempts found
        setDashboardData({
          attempts: [],
          totalQuizzes: 0,
          averageScore: 0,
          recentAttempts: [],
          chartData: []
        })
      } else {
        throw new Error('Failed to fetch quiz attempts')
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError('Failed to load dashboard data. Please try again.')
      
      // Set mock data for demonstration if API fails
      const mockData = generateMockData()
      setDashboardData(mockData)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Process attempts data for dashboard display
  const processAttemptsData = (attempts) => {
    if (!attempts || attempts.length === 0) {
      return {
        attempts: [],
        totalQuizzes: 0,
        averageScore: 0,
        recentAttempts: [],
        chartData: []
      }
    }

    // Calculate statistics using the generated percentage field
    const totalQuizzes = attempts.length
    const totalPercentage = attempts.reduce((sum, attempt) => sum + (parseFloat(attempt.percentage) || 0), 0)
    const averageScore = totalQuizzes > 0 ? Math.round(totalPercentage / totalQuizzes) : 0

    // Get recent attempts (last 10) - use created_at instead of completed_at
    const recentAttempts = attempts
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)

    // Prepare chart data (last 30 days) - use created_at
    const chartData = attempts
      .filter(attempt => {
        const attemptDate = new Date(attempt.created_at)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        return attemptDate >= thirtyDaysAgo
      })
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((attempt, index) => ({
        attempt: index + 1,
        score: Math.round(parseFloat(attempt.percentage) || 0),
        date: new Date(attempt.created_at).toLocaleDateString(),
        topic: attempt.topic || 'General'
      }))

    return {
      attempts,
      totalQuizzes,
      averageScore,
      recentAttempts,
      chartData
    }
  }

  // Generate mock data for demonstration
  const generateMockData = () => {
    const mockAttempts = [
      { id: 1, topic: 'Machine Learning', score: 0.85, completed_at: '2025-10-07T10:30:00Z', total_questions: 10 },
      { id: 2, topic: 'Data Structures', score: 0.92, completed_at: '2025-10-06T14:20:00Z', total_questions: 15 },
      { id: 3, topic: 'Algorithms', score: 0.78, completed_at: '2025-10-05T16:45:00Z', total_questions: 12 },
      { id: 4, topic: 'Computer Networks', score: 0.88, completed_at: '2025-10-04T09:15:00Z', total_questions: 8 },
      { id: 5, topic: 'Database Systems', score: 0.91, completed_at: '2025-10-03T11:30:00Z', total_questions: 20 }
    ]

    return processAttemptsData(mockAttempts)
  }

  useEffect(() => {
    fetchDashboardData()
  }, [user, session])

  const handleRefresh = () => {
    fetchDashboardData(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading dashboard...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Learning Dashboard</h1>
              <p className="mt-2 text-gray-600">Track your progress and performance</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Refreshing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Data
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-md bg-yellow-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-800">{error}</p>
                <p className="text-sm text-yellow-600 mt-1">Showing demo data below.</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Quizzes</dt>
                    <dd className="text-lg font-medium text-gray-900">{dashboardData.totalQuizzes}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Average Score</dt>
                    <dd className="text-lg font-medium text-gray-900">{Math.round(dashboardData.averageScore)}%</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Best Score</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {dashboardData.attempts.length > 0 
                        ? Math.round(Math.max(...dashboardData.attempts.map(a => a.percentage || 0))) + '%'
                        : '0%'
                      }
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Recent Activity</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {dashboardData.recentAttempts.length > 0 
                        ? new Date(dashboardData.recentAttempts[0].created_at).toLocaleDateString()
                        : 'No activity'
                      }
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        {dashboardData.chartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Line Chart - Score Progression */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Score Progression</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dashboardData.chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="attempt" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip 
                    labelFormatter={(value) => `Attempt ${value}`}
                    formatter={(value, name) => [`${value}%`, 'Score']}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                    name="Quiz Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart - Scores by Topic */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Performance by Topic</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dashboardData.chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="topic" angle={-45} textAnchor="end" height={80} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value, name) => [`${value}%`, 'Score']} />
                  <Legend />
                  <Bar dataKey="score" fill="#10B981" name="Quiz Score" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Recent Quiz Attempts Table */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Quiz Attempts</h3>
            {dashboardData.recentAttempts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Topic
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Questions
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Performance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dashboardData.recentAttempts.map((attempt, index) => {
                      const scorePercentage = Math.round(attempt.percentage || 0)
                      const performanceColor = scorePercentage >= 80 ? 'text-green-600' : 
                                             scorePercentage >= 60 ? 'text-yellow-600' : 'text-red-600'
                      const performanceBg = scorePercentage >= 80 ? 'bg-green-100' : 
                                          scorePercentage >= 60 ? 'bg-yellow-100' : 'bg-red-100'
                      const performanceText = scorePercentage >= 80 ? 'Excellent' : 
                                            scorePercentage >= 60 ? 'Good' : 'Needs Improvement'
                      
                      return (
                        <tr key={attempt.id || index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {attempt.topic || 'General'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center">
                              <span className="font-medium">{scorePercentage}%</span>
                              <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${
                                    scorePercentage >= 80 ? 'bg-green-500' : 
                                    scorePercentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${scorePercentage}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {attempt.total || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(attempt.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${performanceBg} ${performanceColor}`}>
                              {performanceText}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No quiz attempts yet</h3>
                <p className="mt-1 text-sm text-gray-500">Start taking quizzes to see your progress here.</p>
              </div>
            )}
          </div>
        </div>

        {/* API Integration Notice */}
        <div className="bg-blue-50 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-blue-900">Learning Analytics Dashboard</h3>
              <p className="mt-2 text-blue-700">
                {error ? (
                  <>This dashboard is showing demo data. Once you start taking quizzes, your real progress will be tracked here. The system will fetch data from <code className="bg-blue-200 px-1 rounded">/api/attempts?userId={user?.id}</code> to show your actual learning progress.</>
                ) : (
                  <>Your learning progress is being tracked in real-time. Take more quizzes to see your performance trends and improvement over time. All data is fetched live from your quiz attempts.</>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage