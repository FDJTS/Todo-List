// Statistics Manager
class StatsManager {
  constructor(app) {
    this.app = app;
  }

  show() {
    const modal = document.getElementById('statsModal');
    const content = document.getElementById('statsContent');
    
    content.innerHTML = this.renderStats();
    modal.classList.add('active');
  }

  renderStats() {
    const stats = this.calculateStats();
    
    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.totalTasks}</div>
          <div class="stat-label">Total Tasks</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-value">${stats.completedTasks}</div>
          <div class="stat-label">Completed</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-value">${stats.pendingTasks}</div>
          <div class="stat-label">Pending</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-value">${stats.overdueTasks}</div>
          <div class="stat-label">Overdue</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-value">${stats.completionRate}%</div>
          <div class="stat-label">Completion Rate</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-value">${stats.averageTasksPerDay}</div>
          <div class="stat-label">Tasks/Day (Avg)</div>
        </div>
      </div>

      <div class="stats-section">
        <h3>Priority Distribution</h3>
        <div class="priority-chart">
          ${this.renderPriorityChart(stats.priorityDistribution)}
        </div>
      </div>

      <div class="stats-section">
        <h3>Most Used Tags</h3>
        <div class="tag-cloud">
          ${this.renderTagCloud(stats.tagUsage)}
        </div>
      </div>

      <div class="stats-section">
        <h3>Productivity Trends</h3>
        <div class="productivity-chart">
          ${this.renderProductivityChart(stats.dailyCompletion)}
        </div>
      </div>

      <div class="stats-section">
        <h3>Task Age Distribution</h3>
        <div class="age-distribution">
          ${this.renderAgeDistribution(stats.ageDistribution)}
        </div>
      </div>

      <div class="stats-section">
        <h3>Insights</h3>
        <div class="insights">
          ${this.renderInsights(stats)}
        </div>
      </div>
    `;
  }

  calculateStats() {
    const tasks = this.app.tasks;
    const now = new Date();
    
    // Basic counts
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const pendingTasks = totalTasks - completedTasks;
    const overdueTasks = tasks.filter(t => t.isOverdue()).length;
    
    // Completion rate
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // Priority distribution
    const priorityDistribution = {
      high: tasks.filter(t => t.priority === 'high').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      low: tasks.filter(t => t.priority === 'low').length
    };
    
    // Tag usage
    const tagUsage = {};
    tasks.forEach(task => {
      task.tags.forEach(tag => {
        tagUsage[tag] = (tagUsage[tag] || 0) + 1;
      });
    });
    
    // Daily completion stats (last 30 days)
    const dailyCompletion = this.calculateDailyCompletion(tasks, 30);
    
    // Average tasks per day
    const daysActive = this.calculateActiveDays(tasks);
    const averageTasksPerDay = daysActive > 0 ? Math.round(totalTasks / daysActive * 10) / 10 : 0;
    
    // Task age distribution
    const ageDistribution = this.calculateAgeDistribution(tasks);
    
    // Recurring task stats
    const recurringTasks = tasks.filter(t => t.recurrence).length;
    
    // Due date stats
    const tasksWithDueDate = tasks.filter(t => t.dueDate).length;
    const dueDateUsage = totalTasks > 0 ? Math.round((tasksWithDueDate / totalTasks) * 100) : 0;
    
    // Completion speed (average time from creation to completion)
    const averageCompletionTime = this.calculateAverageCompletionTime(tasks);
    
    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      completionRate,
      priorityDistribution,
      tagUsage,
      dailyCompletion,
      averageTasksPerDay,
      ageDistribution,
      recurringTasks,
      dueDateUsage,
      averageCompletionTime
    };
  }

  calculateDailyCompletion(tasks, days) {
    const dailyData = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const completed = tasks.filter(task => {
        if (!task.completedAt) return false;
        const completedDate = new Date(task.completedAt);
        return completedDate >= date && completedDate < nextDate;
      }).length;
      
      const created = tasks.filter(task => {
        const createdDate = new Date(task.createdAt);
        return createdDate >= date && createdDate < nextDate;
      }).length;
      
      dailyData.push({
        date: date.toISOString().split('T')[0],
        completed,
        created,
        dayName: date.toLocaleDateString('en', { weekday: 'short' })
      });
    }
    
    return dailyData;
  }

  calculateActiveDays(tasks) {
    if (tasks.length === 0) return 0;
    
    const dates = new Set();
    tasks.forEach(task => {
      const createdDate = new Date(task.createdAt).toDateString();
      dates.add(createdDate);
      
      if (task.completedAt) {
        const completedDate = new Date(task.completedAt).toDateString();
        dates.add(completedDate);
      }
    });
    
    return Math.max(1, dates.size);
  }

  calculateAgeDistribution(tasks) {
    const now = new Date();
    const distribution = {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      older: 0
    };
    
    tasks.forEach(task => {
      const created = new Date(task.createdAt);
      const ageInDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
      
      if (ageInDays === 0) {
        distribution.today++;
      } else if (ageInDays <= 7) {
        distribution.thisWeek++;
      } else if (ageInDays <= 30) {
        distribution.thisMonth++;
      } else {
        distribution.older++;
      }
    });
    
    return distribution;
  }

  calculateAverageCompletionTime(tasks) {
    const completedTasks = tasks.filter(t => t.completed && t.completedAt);
    
    if (completedTasks.length === 0) return 0;
    
    const totalTime = completedTasks.reduce((sum, task) => {
      const created = new Date(task.createdAt);
      const completed = new Date(task.completedAt);
      return sum + (completed - created);
    }, 0);
    
    const averageMs = totalTime / completedTasks.length;
    return Math.round(averageMs / (1000 * 60 * 60 * 24) * 10) / 10; // Days
  }

  renderPriorityChart(distribution) {
    const total = distribution.high + distribution.medium + distribution.low;
    if (total === 0) return '<p class="no-data">No data available</p>';
    
    const highPercent = Math.round((distribution.high / total) * 100);
    const mediumPercent = Math.round((distribution.medium / total) * 100);
    const lowPercent = 100 - highPercent - mediumPercent;
    
    return `
      <div class="priority-bar">
        <div class="priority-segment high" style="width: ${highPercent}%" 
             title="High: ${distribution.high} tasks (${highPercent}%)"></div>
        <div class="priority-segment medium" style="width: ${mediumPercent}%" 
             title="Medium: ${distribution.medium} tasks (${mediumPercent}%)"></div>
        <div class="priority-segment low" style="width: ${lowPercent}%" 
             title="Low: ${distribution.low} tasks (${lowPercent}%)"></div>
      </div>
      <div class="priority-legend">
        <span class="legend-item high">High: ${distribution.high}</span>
        <span class="legend-item medium">Medium: ${distribution.medium}</span>
        <span class="legend-item low">Low: ${distribution.low}</span>
      </div>
    `;
  }

  renderTagCloud(tagUsage) {
    const tags = Object.entries(tagUsage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20); // Top 20 tags
    
    if (tags.length === 0) {
      return '<p class="no-data">No tags used yet</p>';
    }
    
    const maxUsage = Math.max(...tags.map(([,count]) => count));
    
    return tags.map(([tag, count]) => {
      const size = Math.max(0.8, (count / maxUsage) * 2);
      return `<span class="tag-item" style="font-size: ${size}em" title="${count} uses">#${tag}</span>`;
    }).join(' ');
  }

  renderProductivityChart(dailyData) {
    if (dailyData.length === 0) {
      return '<p class="no-data">No productivity data available</p>';
    }
    
    const maxValue = Math.max(...dailyData.map(d => Math.max(d.completed, d.created)), 1);
    
    return `
      <div class="productivity-bars">
        ${dailyData.slice(-14).map(day => `
          <div class="day-bar" title="${day.date}: ${day.completed} completed, ${day.created} created">
            <div class="bar-created" style="height: ${(day.created / maxValue) * 100}%"></div>
            <div class="bar-completed" style="height: ${(day.completed / maxValue) * 100}%"></div>
            <div class="day-label">${day.dayName}</div>
          </div>
        `).join('')}
      </div>
      <div class="chart-legend">
        <span class="legend-item created">Created</span>
        <span class="legend-item completed">Completed</span>
      </div>
    `;
  }

  renderAgeDistribution(distribution) {
    const total = distribution.today + distribution.thisWeek + distribution.thisMonth + distribution.older;
    
    if (total === 0) {
      return '<p class="no-data">No tasks available</p>';
    }
    
    return `
      <div class="age-bars">
        <div class="age-item">
          <div class="age-label">Today</div>
          <div class="age-bar">
            <div class="age-fill" style="width: ${(distribution.today / total) * 100}%"></div>
          </div>
          <div class="age-count">${distribution.today}</div>
        </div>
        <div class="age-item">
          <div class="age-label">This Week</div>
          <div class="age-bar">
            <div class="age-fill" style="width: ${(distribution.thisWeek / total) * 100}%"></div>
          </div>
          <div class="age-count">${distribution.thisWeek}</div>
        </div>
        <div class="age-item">
          <div class="age-label">This Month</div>
          <div class="age-bar">
            <div class="age-fill" style="width: ${(distribution.thisMonth / total) * 100}%"></div>
          </div>
          <div class="age-count">${distribution.thisMonth}</div>
        </div>
        <div class="age-item">
          <div class="age-label">Older</div>
          <div class="age-bar">
            <div class="age-fill" style="width: ${(distribution.older / total) * 100}%"></div>
          </div>
          <div class="age-count">${distribution.older}</div>
        </div>
      </div>
    `;
  }

  renderInsights(stats) {
    const insights = [];
    
    // Completion rate insights
    if (stats.completionRate >= 80) {
      insights.push('🎉 Excellent! Your completion rate is very high.');
    } else if (stats.completionRate >= 60) {
      insights.push('👍 Good job! Your completion rate is above average.');
    } else if (stats.completionRate >= 40) {
      insights.push('📈 Room for improvement in task completion.');
    } else if (stats.totalTasks > 0) {
      insights.push('🎯 Focus on completing existing tasks before adding new ones.');
    }
    
    // Overdue tasks insight
    if (stats.overdueTasks > 0) {
      insights.push(`⏰ You have ${stats.overdueTasks} overdue task${stats.overdueTasks > 1 ? 's' : ''}. Consider prioritizing them.`);
    }
    
    // Priority distribution insights
    const highPriorityPercent = stats.totalTasks > 0 ? 
      Math.round((stats.priorityDistribution.high / stats.totalTasks) * 100) : 0;
    
    if (highPriorityPercent > 50) {
      insights.push('🔥 Consider if all high-priority tasks are truly urgent.');
    } else if (highPriorityPercent < 10 && stats.totalTasks > 10) {
      insights.push('📋 You might benefit from setting more clear priorities.');
    }
    
    // Tag usage insights
    const totalTags = Object.keys(stats.tagUsage).length;
    if (totalTags === 0 && stats.totalTasks > 5) {
      insights.push('🏷️ Try using tags to better organize your tasks.');
    } else if (totalTags > stats.totalTasks * 0.8) {
      insights.push('🎯 Consider consolidating similar tags for better organization.');
    }
    
    // Productivity insights
    const recentCompletion = stats.dailyCompletion.slice(-7).reduce((sum, day) => sum + day.completed, 0);
    if (recentCompletion === 0 && stats.pendingTasks > 0) {
      insights.push('💪 No tasks completed this week. Time to get back on track!');
    }
    
    // Due date insights
    if (stats.dueDateUsage < 30 && stats.totalTasks > 5) {
      insights.push('📅 Setting due dates can help you stay on track with your goals.');
    }
    
    if (insights.length === 0) {
      insights.push('Keep up the great work with your task management! 🌟');
    }
    
    return insights.map(insight => `<div class="insight-item">${insight}</div>`).join('');
  }

  exportStats() {
    const stats = this.calculateStats();
    
    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalTasks: stats.totalTasks,
        completedTasks: stats.completedTasks,
        pendingTasks: stats.pendingTasks,
        overdueTasks: stats.overdueTasks,
        completionRate: stats.completionRate
      },
      detailed: stats,
      insights: this.renderInsights(stats).replace(/<[^>]*>/g, '') // Strip HTML
    };
  }
}