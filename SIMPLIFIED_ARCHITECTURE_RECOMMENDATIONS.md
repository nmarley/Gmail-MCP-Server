# Gmail MCP Server - Simplified Architecture Recommendations

## Overview
This document outlines the recommended simplified architecture for a **stateless Gmail MCP proxy server** that accepts OAuth credentials per request, eliminating complex session management while supporting multiple Gmail users.

## ✅ Implementation Checklist

### Phase 1: Remove Complex Session Management
- [ ] **Strip out all session management code**
  - [ ] Remove `SessionAwareTransportManager`
  - [ ] Remove `AsyncLocalStorage` context management
  - [ ] Remove session token generation and validation
  - [ ] Remove credential file storage (`CONFIG_DIR`, `OAUTH_PATH`, `CREDENTIALS_PATH`)

- [ ] **Remove authentication tools from MCP server**
  - [ ] Remove `setup_authentication` tool
  - [ ] Remove `get_auth_url` tool  
  - [ ] Remove `check_authentication` tool
  - [ ] Remove `authenticate_with_token` tool

- [ ] **Simplify transport to stdio only** (for local usage)
  - [ ] Remove HTTP and SSE transport modes
  - [ ] Remove Express server and session management endpoints
  - [ ] Keep only `StdioServerTransport` for direct MCP communication

### Phase 2: Add OAuth Credentials to Tool Schemas

- [ ] **Update all Gmail tool schemas to accept OAuth credentials**
  ```typescript
  // Add to every tool schema:
  oauth_credentials: z.object({
    access_token: z.string().describe("Valid OAuth access token"),
    client_id: z.string().describe("OAuth client ID"),
    client_secret: z.string().describe("OAuth client secret"),
    refresh_token: z.string().optional().describe("Refresh token (not used by MCP)")
  }).describe("OAuth credentials for Gmail API access")
  ```

- [ ] **Updated tool list requiring OAuth parameters:**
  - [ ] `send_email` - Add oauth_credentials parameter
  - [ ] `read_email` - Add oauth_credentials parameter
  - [ ] `search_emails` - Add oauth_credentials parameter
  - [ ] `modify_email` - Add oauth_credentials parameter
  - [ ] `delete_email` - Add oauth_credentials parameter
  - [ ] `list_email_labels` - Add oauth_credentials parameter
  - [ ] `batch_modify_emails` - Add oauth_credentials parameter
  - [ ] `batch_delete_emails` - Add oauth_credentials parameter
  - [ ] `create_label` - Add oauth_credentials parameter
  - [ ] `update_label` - Add oauth_credentials parameter
  - [ ] `delete_label` - Add oauth_credentials parameter
  - [ ] `get_or_create_label` - Add oauth_credentials parameter
  - [ ] `download_attachment` - Add oauth_credentials parameter

### Phase 3: Implement Stateless Gmail Client Creation

- [ ] **Create Gmail client factory function**
  ```typescript
  function createGmailClient(oauthCredentials: OAuthCredentials): gmail_v1.Gmail {
    const oauth2Client = new OAuth2Client(
      oauthCredentials.client_id,
      oauthCredentials.client_secret
    );
    oauth2Client.setCredentials({
      access_token: oauthCredentials.access_token
    });
    return google.gmail({ version: 'v1', auth: oauth2Client });
  }
  ```

- [ ] **Update each tool handler to:**
  - [ ] Extract oauth_credentials from request arguments
  - [ ] Create fresh Gmail client for each request
  - [ ] Execute Gmail API operation
  - [ ] Return structured response (success/error)

### Phase 4: Implement Structured Error Handling

- [ ] **Define standard response format**
  ```typescript
  interface ToolResponse {
    success: boolean;
    data?: any;
    error?: {
      code: number;
      message: string;
      type: string;
    };
  }
  ```

- [ ] **Update all tool handlers with try/catch blocks**
  ```typescript
  try {
    const result = await gmail.users.messages.send(params);
    return { 
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          success: true,
          data: { messageId: result.data.id }
        })
      }] 
    };
  } catch (error) {
    return { 
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          success: false,
          error: {
            code: error.code || 500,
            message: error.message,
            type: error.status || 'GMAIL_API_ERROR'
          }
        })
      }] 
    };
  }
  ```

- [ ] **Handle specific Gmail API error codes:**
  - [ ] 401 - Invalid/expired credentials
  - [ ] 403 - Insufficient permissions
  - [ ] 404 - Resource not found (message, label, etc.)
  - [ ] 429 - Rate limit exceeded
  - [ ] 500 - Internal server error

### Phase 5: Client Application Integration

- [ ] **Implement token management in your application:**
  ```typescript
  function isTokenExpiringSoon(tokenData: TokenData, bufferSeconds = 60): boolean {
    const now = Date.now();
    const expiryTime = tokenData.expiry_date;
    const timeUntilExpiry = expiryTime - now;
    return timeUntilExpiry < (bufferSeconds * 1000);
  }

  async function getValidToken(userTokenData: UserTokens): Promise<string> {
    if (isTokenExpiringSoon(userTokenData, 60)) {
      const newTokens = await refreshUserTokens(userTokenData);
      await saveUserTokens(userTokenData.userId, newTokens);
      return newTokens.access_token;
    }
    return userTokenData.access_token;
  }
  ```

- [ ] **Implement MCP client error handling:**
  ```typescript
  async function callGmailMCP(toolName: string, params: any, userTokens: UserTokens) {
    try {
      const validToken = await getValidToken(userTokens);
      const result = await mcpClient.callTool(toolName, {
        ...params,
        oauth_credentials: {
          access_token: validToken,
          client_id: userTokens.client_id,
          client_secret: userTokens.client_secret
        }
      });
      
      const response = JSON.parse(result.content[0].text);
      
      if (!response.success) {
        switch (response.error.code) {
          case 401:
            await forceTokenRefresh(userTokens);
            throw new Error("Authentication failed, please retry");
          case 403:
            throw new Error("Insufficient Gmail permissions");
          case 429:
            throw new Error("Rate limit exceeded, try again later");
          default:
            throw new Error(`Gmail error: ${response.error.message}`);
        }
      }
      
      return response.data;
      
    } catch (error) {
      console.error(`MCP ${toolName} error:`, error);
      throw error;
    }
  }
  ```

### Phase 6: Testing & Validation

- [ ] **Test multi-user scenarios:**
  - [ ] Verify different users can use the same MCP server simultaneously
  - [ ] Confirm no credential leakage between users
  - [ ] Test with expired tokens (should return 401 errors cleanly)

- [ ] **Test error handling:**
  - [ ] Invalid credentials (401)
  - [ ] Insufficient permissions (403)
  - [ ] Rate limiting (429)
  - [ ] Network errors
  - [ ] Malformed requests

- [ ] **Performance validation:**
  - [ ] Measure OAuth client creation overhead (~2-3ms - should be negligible)
  - [ ] Test with realistic Gmail API response times (50-500ms)
  - [ ] Verify no memory leaks from uncached clients

## Architecture Benefits

### ✅ Advantages of This Approach:
- [ ] **Stateless MCP Server**: No session state to manage or debug
- [ ] **Simple Deployment**: Just run the MCP server, no database or persistent storage needed
- [ ] **Clear Separation**: Your app owns authentication, MCP server owns Gmail API operations
- [ ] **Multi-User Ready**: Unlimited Gmail users through your app's credential management
- [ ] **Local Development Friendly**: Perfect for local development scenarios
- [ ] **Predictable Error Handling**: Structured responses with Gmail API error codes preserved

### ⚠️ Trade-offs Accepted:
- [ ] **Your App Handles Auth Complexity**: Token refresh logic lives in your application
- [ ] **Per-Request Client Creation**: ~2-3ms overhead (negligible vs Gmail API latency)
- [ ] **No Caching**: Each request creates fresh OAuth/Gmail clients (acceptable for typical usage)

## Final Architecture Flow

```
Your App
    ↓ (manages OAuth tokens for multiple users)
    ↓ (ensures tokens are fresh before MCP calls)
    ↓
MCP Server (Stateless)
    ↓ (receives OAuth credentials per request)
    ↓ (creates fresh Gmail client for each call)
    ↓ (returns structured success/error responses)
    ↓
Gmail API
    ↓ (processes request with provided credentials)
    ↓
Response back through same chain
```

## 🎯 Success Criteria

- [ ] **MCP server has zero persistent state**
- [ ] **All Gmail operations work with provided OAuth credentials**
- [ ] **Multiple users can use server simultaneously without interference**
- [ ] **Gmail API errors are properly structured and returned to client**
- [ ] **Token refresh is handled entirely by your application**
- [ ] **Performance is acceptable for typical email operations**

---

**Next Steps**: Once this checklist is complete, you'll have a clean, simple Gmail MCP proxy that John Carmack would approve of - maximum functionality with minimum complexity! 🚀