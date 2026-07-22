Set-Location "f:/OneDrive/Documents/GitHub/SGS1_G6_A1"

$files = Get-ChildItem "Static_html_css" -Recurse -Filter *.html | Where-Object { $_.FullName -notmatch 'Static_html_css[\\/]homepage[\\/]homepage\.html$' }

$headerMarkup = @'
<header class="rshop-top-header">
    <div class="rshop-header-container">
        <div class="rshop-logo-section">
            <a href="../shopping_cart/cart.html" class="rshop-cart-icon" aria-label="Cart">&#128722;</a>
            <a href="../homepage/homepage.html" class="rshop-logo">Rshop</a>
        </div>
        <nav class="rshop-nav" aria-label="Main navigation">
            <a href="../homepage/homepage.html" class="rshop-nav-link">Home</a>
            <a href="../shopping_cart/products.html" class="rshop-nav-link">Market</a>
            <a href="../Blog/blog-list.html" class="rshop-nav-link">Blog</a>
            <a href="../discuss_forum/forum.html" class="rshop-nav-link">Forum</a>
            <a href="../discuss_forum/wishlist.html" class="rshop-nav-link">Wishlist</a>
            <a href="../shopping_cart/cart.html" class="rshop-nav-link">Cart</a>
            <a href="../Product_Review_Rating/review.html" class="rshop-nav-link">Review</a>
            <a href="../discuss_forum/create-thread.html" class="rshop-nav-link">Post</a>
            <a href="../user_account/profile.html" class="rshop-nav-link">Profile</a>
            <a href="../user_account/auth.html" class="rshop-nav-link">Sign In</a>
        </nav>
    </div>
</header>
'@

$headerWithNavRegex = [regex]::new('<header\b[\s\S]*?<nav[\s\S]*?</nav>[\s\S]*?</header>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$firstNavRegex = [regex]::new('<nav\b[\s\S]*?</nav>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$bodyRegex = [regex]::new('<body([^>]*)>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $updated = $content

    if ($updated -notmatch 'top-nav\.css') {
        $updated = $updated -replace '</head>', '    <link rel="stylesheet" href="../css/top-nav.css">`r`n</head>'
    }

    $removedByHeader = $false
    if ($headerWithNavRegex.IsMatch($updated)) {
        $updated = $headerWithNavRegex.Replace($updated, '', 1)
        $removedByHeader = $true
    }

    if (-not $removedByHeader -and $firstNavRegex.IsMatch($updated)) {
        $updated = $firstNavRegex.Replace($updated, '', 1)
    }

    $bodyMatch = $bodyRegex.Match($updated)
    if ($bodyMatch.Success) {
        $attrs = $bodyMatch.Groups[1].Value
        if ($attrs -match 'class\s*=\s*"([^"]*)"') {
            $classValue = $Matches[1]
            if ($classValue -notmatch '\bwith-rshop-nav\b') {
                $newClass = ($classValue.Trim() + ' with-rshop-nav').Trim()
                $newAttrs = [regex]::Replace($attrs, 'class\s*=\s*"([^"]*)"', ('class="' + $newClass + '"'), 1)
                $newBodyOpen = "<body$newAttrs>"
            } else {
                $newBodyOpen = "<body$attrs>"
            }
        } else {
            $newBodyOpen = '<body' + $attrs + ' class="with-rshop-nav">'
        }

        $insert = $newBodyOpen + "`r`n" + $headerMarkup
        $updated = $updated.Substring(0, $bodyMatch.Index) + $insert + $updated.Substring($bodyMatch.Index + $bodyMatch.Length)
    }

    if ($updated -ne $content) {
        Set-Content -Path $file.FullName -Value $updated -Encoding utf8
        Write-Output "Updated: $($file.FullName)"
    }
}
