$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$backendRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "Running backend API tests..." -ForegroundColor Cyan
Push-Location $backendRoot
try {
    npm test
    if ($LASTEXITCODE -ne 0) {
        throw "Backend tests failed."
    }
}
finally {
    Pop-Location
}

$javascriptFiles = @(
    "Static_html_css\backend\src\server.js",
    "Static_html_css\backend\src\data\db.js",
    "Static_html_css\Blog\blog.js",
    "Static_html_css\admin\admin.js",
    "Static_html_css\Product_Review_Rating\review.js",
    "Static_html_css\discuss_forum\js\discussion_forum.js",
    "Static_html_css\discuss_forum\js\forum-page.js",
    "Static_html_css\discuss_forum\js\thread-detail.js",
    "Static_html_css\discuss_forum\js\wishlist.js",
    "Static_html_css\shopping_cart\cart-page.js",
    "Static_html_css\shopping_cart\js\main.js",
    "Static_html_css\user_account\js\user-account.js"
)

Write-Host "Checking JavaScript syntax..." -ForegroundColor Cyan
foreach ($relativePath in $javascriptFiles) {
    $filePath = Join-Path $repoRoot $relativePath
    Write-Host "  $relativePath"
    node --check $filePath
    if ($LASTEXITCODE -ne 0) {
        throw "JavaScript syntax check failed: $relativePath"
    }
}

Write-Host "All backend tests and JavaScript checks passed." -ForegroundColor Green
