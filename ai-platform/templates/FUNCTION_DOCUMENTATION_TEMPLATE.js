/**
 * [Brief one-line description of what the function does]
 * 
 * [Detailed description (2-4 sentences) explaining:
 * - The main purpose and context of the function
 * - Key algorithmic approach (if complex)
 * - Important side effects or state changes
 * - Performance characteristics or considerations
 * - Security implications if applicable]
 * 
 * @param {type} paramName - [Description of parameter and its purpose]
 * @param {type} paramName - [Description of parameter and its purpose]
 * @param {type} paramName - [Description of parameter and its purpose]
 * @returns {type} [Description of return value and what it represents]
 * 
 * @throws {ErrorType} [Description of when this error is thrown]
 * @throws {ErrorType} [Description of when this error is thrown]
 * 
 * @example
 * // Basic usage example
 * const result = functionName(param1, param2);
 * console.log(result);
 * 
 * @example
 * // Advanced usage example
 * const options = {
 *   option1: true,
 *   option2: 'value'
 * };
 * const result = functionName(param1, options);
 * 
 * @see [RelatedFunctionName] - [Description of relationship]
 * @see [Related documentation link]
 * 
 * @since [Version when function was introduced]
 * @author [Original author name]
 * @deprecated [If deprecated, include alternative]
 * 
 * @todo [Future improvements or known issues]
 */
function functionName(paramName, paramName, paramName) {
  // Implementation here
  
  /**
   * [Helper function description if applicable]
   * 
   * @param {type} helperParam - [Description]
   * @returns {type} [Description]
   */
  function helperFunction(helperParam) {
    // Helper implementation
  }
  
  // Main implementation
  // Add inline comments for complex logic:
  // Step 1: [What this step does]
  // Step 2: [What this step does]
  // Step 3: [What this step does]
  
  return result;
}

/**
 * [Alternative function template for async functions]
 * 
 * [Description for async function]
 * 
 * @param {type} paramName - [Description]
 * @returns {Promise<type>} [Description of what promise resolves to]
 * 
 * @async
 */
async function asyncFunctionName(paramName) {
  try {
    // Async implementation
    const result = await someAsyncOperation();
    return result;
  } catch (error) {
    // Error handling
    throw new Error(`Operation failed: ${error.message}`);
  }
}

/**
 * [Class documentation template]
 * 
 * [Description of class purpose and responsibility]
 * 
 * @example
 * const instance = new ClassName(param1, param2);
 * instance.methodName();
 */
class ClassName {
  /**
   * Creates an instance of ClassName
   * 
   * @param {type} paramName - [Description]
   * @param {type} paramName - [Description]
   */
  constructor(paramName, paramName) {
    // Constructor implementation
    this.propertyName = paramName;
  }
  
  /**
   * [Method description]
   * 
   * @param {type} paramName - [Description]
   * @returns {type} [Description]
   */
  methodName(paramName) {
    // Method implementation
    return result;
  }
  
  /**
   * [Private method description]
   * 
   * @private
   * @param {type} paramName - [Description]
   * @returns {type} [Description]
   */
  _privateMethodName(paramName) {
    // Private method implementation
    return result;
  }
}