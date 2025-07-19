class SimpleBlog {
    constructor() {
        this.posts = document.querySelectorAll('.post');
        this.searchInput = document.getElementById('search-input');
        this.themeToggle = document.getElementById('theme-toggle');
        this.postsContainer = document.getElementById('posts-container');
        this.noResults = document.getElementById('no-results');
        
        this.initializeTheme();
        this.initializeEventListeners();
        this.initializeComments();
        this.initializeLikes();
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('blog-theme') || 'light';
        this.setTheme(savedTheme);
        
        // Add system preference detection
        if (!localStorage.getItem('blog-theme')) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.setTheme(prefersDark ? 'dark' : 'light');
        }
        
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('blog-theme-manual')) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
        localStorage.setItem('blog-theme', theme);
        localStorage.setItem('blog-theme-manual', 'true');
        
        // Add smooth transition animation
        document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
        setTimeout(() => {
            document.body.style.transition = '';
        }, 300);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    initializeEventListeners() {
        this.searchInput.addEventListener('input', this.handleSearch.bind(this));
        this.themeToggle.addEventListener('click', this.toggleTheme.bind(this));
        
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clearSearch();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === '/') {
                e.preventDefault();
                this.searchInput.focus();
            }
        });
    }

    handleSearch() {
        const searchTerm = this.searchInput.value.toLowerCase().trim();
        let visiblePosts = 0;

        this.posts.forEach(post => {
            const title = post.querySelector('.post-title').textContent.toLowerCase();
            const content = post.querySelector('.post-content').textContent.toLowerCase();
            const category = post.querySelector('.post-category').textContent.toLowerCase();
            const date = post.querySelector('.post-date').textContent.toLowerCase();

            const matches = title.includes(searchTerm) || 
                          content.includes(searchTerm) || 
                          category.includes(searchTerm) ||
                          date.includes(searchTerm);

            if (matches || searchTerm === '') {
                post.style.display = 'block';
                visiblePosts++;
            } else {
                post.style.display = 'none';
            }
        });

        this.noResults.style.display = visiblePosts === 0 ? 'block' : 'none';
        this.postsContainer.style.display = visiblePosts === 0 ? 'none' : 'grid';
    }

    clearSearch() {
        this.searchInput.value = '';
        this.handleSearch();
        this.searchInput.blur();
    }

    initializeComments() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('comment-btn')) {
                const postId = e.target.getAttribute('data-post');
                this.toggleComments(postId);
            }

            if (e.target.classList.contains('submit-comment')) {
                const commentInput = e.target.previousElementSibling;
                const commentsSection = e.target.closest('.comments-section');
                this.addComment(commentInput, commentsSection);
            }
        });

        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('comment-input')) {
                const commentsSection = e.target.closest('.comments-section');
                this.addComment(e.target, commentsSection);
            }
        });
    }

    toggleComments(postId) {
        const commentsSection = document.getElementById(`comments-${postId}`);
        const isVisible = commentsSection.style.display !== 'none';
        
        commentsSection.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            const commentInput = commentsSection.querySelector('.comment-input');
            setTimeout(() => commentInput.focus(), 100);
        }
    }

    addComment(input, commentsSection) {
        const commentText = input.value.trim();
        
        if (commentText === '') {
            this.showNotification('Please enter a comment', 'warning');
            return;
        }

        const newComment = document.createElement('div');
        newComment.className = 'comment';
        newComment.innerHTML = `<strong>You:</strong> ${this.escapeHtml(commentText)}`;
        
        const addCommentDiv = commentsSection.querySelector('.add-comment');
        commentsSection.insertBefore(newComment, addCommentDiv);
        
        input.value = '';
        
        newComment.style.opacity = '0';
        newComment.style.transform = 'translateY(-10px)';
        
        setTimeout(() => {
            newComment.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            newComment.style.opacity = '1';
            newComment.style.transform = 'translateY(0)';
        }, 10);

        this.showNotification('Comment added!', 'success');
    }

    initializeLikes() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('like-btn') || e.target.closest('.like-btn')) {
                const button = e.target.closest('.like-btn') || e.target;
                const postId = button.getAttribute('data-post');
                this.toggleLike(button, postId);
            }
        });

        this.loadLikes();
    }

    toggleLike(button, postId) {
        const countSpan = button.querySelector('.like-count');
        const currentCount = parseInt(countSpan.textContent);
        const isLiked = button.classList.contains('liked');
        
        if (isLiked) {
            button.classList.remove('liked');
            countSpan.textContent = currentCount - 1;
            this.saveLike(postId, false);
        } else {
            button.classList.add('liked');
            countSpan.textContent = currentCount + 1;
            this.saveLike(postId, true);
            this.animateLike(button);
        }
    }

    animateLike(button) {
        button.style.transform = 'scale(1.2)';
        setTimeout(() => {
            button.style.transform = 'scale(1)';
        }, 150);
    }

    saveLike(postId, isLiked) {
        let likes = JSON.parse(localStorage.getItem('blog-likes') || '{}');
        likes[postId] = isLiked;
        localStorage.setItem('blog-likes', JSON.stringify(likes));
    }

    loadLikes() {
        const likes = JSON.parse(localStorage.getItem('blog-likes') || '{}');
        
        Object.entries(likes).forEach(([postId, isLiked]) => {
            if (isLiked) {
                const button = document.querySelector(`[data-post="${postId}"].like-btn`);
                if (button) {
                    button.classList.add('liked');
                }
            }
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            z-index: 1000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            font-size: 0.875rem;
            font-weight: 500;
            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);

        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    filterByCategory(category) {
        this.posts.forEach(post => {
            const postCategory = post.getAttribute('data-category');
            post.style.display = (category === 'all' || postCategory === category) ? 'block' : 'none';
        });
    }

    sortPosts(sortBy) {
        const postsArray = Array.from(this.posts);
        
        postsArray.sort((a, b) => {
            if (sortBy === 'date') {
                const dateA = new Date(a.getAttribute('data-date'));
                const dateB = new Date(b.getAttribute('data-date'));
                return dateB - dateA;
            } else if (sortBy === 'title') {
                const titleA = a.querySelector('.post-title').textContent;
                const titleB = b.querySelector('.post-title').textContent;
                return titleA.localeCompare(titleB);
            }
        });

        postsArray.forEach(post => {
            this.postsContainer.appendChild(post);
        });
    }

    getStats() {
        const totalPosts = this.posts.length;
        const categories = [...new Set(Array.from(this.posts).map(post => 
            post.getAttribute('data-category')
        ))];
        const totalLikes = Array.from(document.querySelectorAll('.like-count'))
            .reduce((sum, span) => sum + parseInt(span.textContent), 0);
        const totalComments = document.querySelectorAll('.comment').length;

        return {
            totalPosts,
            categories: categories.length,
            totalLikes,
            totalComments
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const blog = new SimpleBlog();
    
    window.blog = blog;
    
    console.log('🚀 Simple Blog initialized!');
    console.log('💡 Try these commands in the console:');
    console.log('  blog.filterByCategory("tech") - Filter tech posts');
    console.log('  blog.sortPosts("title") - Sort by title');
    console.log('  blog.getStats() - Get blog statistics');
    console.log('  Ctrl+/ - Focus search box');
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        console.log('👋 Welcome back to Simple Blog!');
    }
});