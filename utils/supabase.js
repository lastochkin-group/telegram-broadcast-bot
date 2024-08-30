const config = require("../config.json")
const { createClient } = require("@supabase/supabase-js")

const supabaseUrl = config.SUPABASE_URL
const supabaseKey = config.SUPABASE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

module.exports = supabase