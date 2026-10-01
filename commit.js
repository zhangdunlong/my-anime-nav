
        $(document).ready(function() {
            // 描述字数统计
            $('#description').on('input', function() {
                const count = $(this).val().length;
                $('#descCount').text(count);
            });

            // 表单验证
            function validateForm() {
                let isValid = true;

                // 清除之前的错误提示
                $('.form-control').removeClass('error');
                $('.error-message').hide();

                // 网站名称验证
                const siteName = $('#siteName').val().trim();
                if (!siteName) {
                    $('#siteName').addClass('error');
                    $('#siteNameError').show();
                    isValid = false;
                }

                // 网址验证
                const siteUrl = $('#siteUrl').val().trim();
                const urlPattern = /^https?:\/\/.+\..+/i;
                if (!siteUrl || !urlPattern.test(siteUrl)) {
                    $('#siteUrl').addClass('error');
                    $('#siteUrlError').show();
                    isValid = false;
                }

                // 分类验证
                const category = $('#category').val();
                if (!category) {
                    $('#category').addClass('error');
                    $('#categoryError').show();
                    isValid = false;
                }

                // 描述验证
                const description = $('#description').val().trim();
                if (!description) {
                    $('#description').addClass('error');
                    $('#descriptionError').show();
                    isValid = false;
                }

                // 邮箱验证
                const email = $('#email').val().trim();
                const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!email || !emailPattern.test(email)) {
                    $('#email').addClass('error');
                    $('#emailError').show();
                    isValid = false;
                }

                return isValid;
            }

            // 表单提交
            $('#submitForm').on('submit', function(e) {
                e.preventDefault();

                if (!validateForm()) {
                    return;
                }

                // 禁用提交按钮
                const $submitBtn = $('#submitBtn');
                $submitBtn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> 提交中...');

                // 收集表单数据
                const formData = {
                    siteName: $('#siteName').val().trim(),
                    siteUrl: $('#siteUrl').val().trim(),
                    category: $('#category').val(),
                    description: $('#description').val().trim(),
                    keywords: $('#keywords').val().trim(),
                    email: $('#email').val().trim(),
                    contact: $('#contact').val().trim(),
                    submitTime: new Date().toISOString()
                };

                // 保存到 localStorage (等待管理员处理)
                var submissions = JSON.parse(localStorage.getItem('anime_nav_submissions') || '[]');
                submissions.push(formData);
                localStorage.setItem('anime_nav_submissions', JSON.stringify(submissions));

                // 显示成功信息
                $('#submitForm')[0].reset();
                $('#descCount').text('0');
                $('.success-message').show();
                $submitBtn.prop('disabled', false).html('<i class="fas fa-paper-plane"></i> 提交网站');
                window.scrollTo({ top: 0, behavior: 'smooth' });

            });

            // 输入时移除错误状态
            $('.form-control').on('input change', function() {
                $(this).removeClass('error');
                $(this).siblings('.error-message').hide();
            });
        });
    